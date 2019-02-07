import cdk = require('@aws-cdk/cdk');
import apigateway = require('@aws-cdk/aws-apigateway');
import dynamoDb = require('@aws-cdk/aws-dynamodb');
import lambda = require('@aws-cdk/aws-lambda');
import iam = require('@aws-cdk/aws-iam');
import s3 = require('@aws-cdk/aws-s3');
import s3Deployment = require('@aws-cdk/aws-s3-deployment');
import sns = require('@aws-cdk/aws-sns');
import path = require('path');

export class PollyNotesReaderStack extends cdk.Stack {
  constructor(parent: cdk.App, name: string, props?: cdk.StackProps) {
    super(parent, name, props);

    // s3 bucket for static public website
    // TODO: How do we push the static content to the s3 bucket on deploy?
    const websiteBucket = new s3.Bucket(this, 'PollyReaderStaticWebsite', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html'
    });
    websiteBucket.grantPublicAccess('*', 's3:GetObject');

    new s3Deployment.BucketDeployment(this, 'PollyReaderStaticAssets', {
      source: s3Deployment.Source.asset('./web'),
      destinationBucket: websiteBucket
    });

    // s3 bucket for dropping mp3s
    const mp3Bucket = new s3.Bucket(this, 'PollyReaderMP3Bucket');

    // DynamoDB table to store notes
    const notesTable = new dynamoDb.Table(this, 'NotesTable', {
      tableName: 'polly-notes',
      partitionKey: { name: 'id', type: dynamoDb.AttributeType.String }
    });

    // SNS topic to trigger when new notes added
    const noteCreatedTopic = new sns.Topic(this, 'NoteCreatedSnsTopic', {
      displayName: 'New Note Created'
    });

    // Managed policy for lambdas to access resources
    const lambdaPolicyStatement = new iam.PolicyStatement(iam.PolicyStatementEffect.Allow);
    lambdaPolicyStatement
      .addActions(
        'polly:SynthesizeSpeech',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'sns:Publish',
        's3:PutObject',
        's3:PutObjectAcl',
        's3:GetBucketLocation',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ).addAllResources();

    const notesApiRoot = path.join('components', 'notes', 'api');
    
    // POST new notes
    const newNotesHandler = new lambda.Function(this, 'PostNotesHandler', {
      runtime: lambda.Runtime.Python27,
      code: lambda.Code.asset(notesApiRoot),
      handler: 'newnote.lambda_handler',
      environment: {
        'SNS_TOPIC': noteCreatedTopic.topicArn,
        'DB_TABLE_NAME': notesTable.tableName
      }
    });
    newNotesHandler.addToRolePolicy(lambdaPolicyStatement);

    // GET notes
    const getNotesHandler = new lambda.Function(this, 'GetNotesHandler', {
      runtime: lambda.Runtime.Python27,
      code: lambda.Code.asset(notesApiRoot),
      handler: 'getnotes.lambda_handler',
      environment: {
        'DB_TABLE_NAME': notesTable.tableName
      }
    });
    getNotesHandler.addToRolePolicy(lambdaPolicyStatement);

    // API gateway with lambda endpoints
    // TODO: Enable CORS
    const api = new apigateway.RestApi(this, 'polly-notes-api', {
      restApiName: 'Polly Notes Service',
      description: 'This service manages text notes, and converts them to audio format using Polly.',
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.Error,
        dataTraceEnabled: true
      }
    });

    // api.root.addMethod('OPTIONS', new apigateway.MockIntegration());
    api.root.addMethod('POST', new apigateway.LambdaIntegration(newNotesHandler, { 
      proxy: false,
      // integrationResponses: [new EnableCORSIntegrationResponse()]
      // methodResponses: TODO
    }));
    
    api.root.addMethod('GET', new apigateway.LambdaIntegration(getNotesHandler, {
      proxy: false,
      requestParameters: {
        'integration.request.querystring.noteId': 'method.request.querystring.noteId'
      }
    }), {
      requestParameters: {
        'method.request.querystring.noteId': true
      }
    });

    // Lambda listening to SNS topic that converts the text to mp3 audio
    const notesWorkerRoot = path.join('components', 'notes', 'workers');
    const convertToMp3Worker = new lambda.Function(this, "ConvertToMp3Worker", {
      runtime: lambda.Runtime.Python27,
      code: lambda.Code.asset(notesWorkerRoot),
      handler: 'convertoaudio.lambda_handler',
      environment: {
        'DB_TABLE_NAME': notesTable.tableName,
        'BUCKET_NAME': mp3Bucket.bucketName
      },
    });
    convertToMp3Worker.addToRolePolicy(lambdaPolicyStatement);
    noteCreatedTopic.subscribeLambda(convertToMp3Worker);
  }
}

export class EnableCORSIntegrationResponse implements apigateway.IntegrationResponse {
  constructor() {
    this.statusCode = '200';
    // this.responseParameters = {
    //   'integration.response.header.Access-Control-Allow-Origin': '\'*\''
    // };
    this.responseTemplates = {
      'application/json': 'Empty'
    };
  }

  statusCode: string;  
  contentHandling?: apigateway.ContentHandling | undefined;
  responseParameters?: { [destination: string]: string; } | undefined;
  responseTemplates?: { [contentType: string]: string; } | undefined;
}
