import cdk = require('@aws-cdk/cdk');
import dynamoDb = require('@aws-cdk/aws-dynamodb');
import s3 = require('@aws-cdk/aws-s3');

export class PollyNotesReaderStack extends cdk.Stack {
  constructor(parent: cdk.App, name: string, props?: cdk.StackProps) {
    super(parent, name, props);

    // TODO: This stack will contain
    // 1. s3 bucket for public website (public access??)
    const websiteBucket = new s3.Bucket(this, 'PollyReaderStaticWebsite', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html'
    });
    websiteBucket.grantPublicAccess('*', 's3:GetObject');
    // 2. s3 bucket for dropping mp3s (public access??)
    new s3.Bucket(this, 'PollyReaderMP3Bucket');
    // 3. API gateway with lambda endpoints
    //    a. POST new notes
    //    b. GET notes
    // 4. DynamoDB table to store notes
    new dynamoDb.Table(this, 'PostsTable', {
      tableName: 'polly-posts',
      partitionKey: { name: 'id', type: dynamoDb.AttributeType.String }
    });
    // 5. SNS topic to trigger when new notes added
    // 6. Lambda listening to SNS topic that converts the text to mp3 audio
  }
  
  toCloudFormation() {
    const res = super.toCloudFormation();
    
    // TODO: Manually fuck with the CFN

    return res;
  }
  
}
