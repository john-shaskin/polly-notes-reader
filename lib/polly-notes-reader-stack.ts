import cdk = require('@aws-cdk/cdk');
import dynamoDb = require('@aws-cdk/aws-dynamodb');
import s3 = require('@aws-cdk/aws-s3');
import lambda = require('@aws-cdk/aws-lambda');
import apigateway = require('@aws-cdk/aws-apigateway');
import iam = require('@aws-cdk/aws-iam');
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
    new dynamoDb.Table(this, 'PostsTable', {
      tableName: 'polly-posts',
      partitionKey: { name: 'id', type: dynamoDb.AttributeType.String }
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
    const postApiRoot = path.join('components', 'posts', 'api');
    const newPostsHandler = new lambda.Function(this, 'PostNotesHandler', {
      runtime: lambda.Runtime.Python27,
      code: lambda.Code.asset(postApiRoot),
      handler: 'newposts.lambda_handler',
      environment: {
        EnvKey1: 'EnvValue1'
      }
    });
    newPostsHandler.addToRolePolicy(lambdaPolicyStatement);

    // GET notes

    // API gateway with lambda endpoints
    const api = new apigateway.RestApi(this, 'polly-posts-api', {
      restApiName: 'Polly Posts Service',
      description: 'This service manages text note posts, and converts them to audio format using Polly.'
    });

    api.root.addMethod('POST', new apigateway.LambdaIntegration(newPostsHandler));

    // SNS topic to trigger when new notes added
    // 6. Lambda listening to SNS topic that converts the text to mp3 audio
  }
}
