import cdk = require('@aws-cdk/cdk');
import apigateway = require('@aws-cdk/aws-apigateway');
import dynamoDb = require('@aws-cdk/aws-dynamodb');
import lambda = require('@aws-cdk/aws-lambda');
import iam = require('@aws-cdk/aws-iam');
import s3 = require('@aws-cdk/aws-s3');
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

    // s3 bucket for dropping mp3s
    new s3.Bucket(this, 'PollyReaderMP3Bucket');

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

    // POST new notes
    const postApiRoot = path.join('components', 'notes', 'api');
    const newNotesHandler = new lambda.Function(this, 'PostNotesHandler', {
      runtime: lambda.Runtime.Python27,
      code: lambda.Code.asset(postApiRoot),
      handler: 'newnote.lambda_handler',
      environment: {
        'SNS_TOPIC': noteCreatedTopic.topicArn, // TODO: Replace with ARN reference to created SNS topic
        'DB_TABLE_NAME': notesTable.tableName
      }
    });
    newNotesHandler.addToRolePolicy(lambdaPolicyStatement);

    // GET notes

    // API gateway with lambda endpoints
    // TODO: Enable CORS
    const api = new apigateway.RestApi(this, 'polly-notes-api', {
      restApiName: 'Polly Notes Service',
      description: 'This service manages text notes, and converts them to audio format using Polly.'
    });

    api.root.addMethod('OPTIONS', new apigateway.MockIntegration());
    const postMethod = api.root.addMethod('POST', new apigateway.LambdaIntegration(newNotesHandler, { proxy: false }));
    // TODO: Add GET method, enable query string parameters (use mappings.json in body mappings)
    // Lambda listening to SNS topic that converts the text to mp3 audio
  }
}
