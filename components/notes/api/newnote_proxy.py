# Use this version of the lambda, if you want to set up a proxy API Gateway Lambda endpoint
import boto3
import os
import uuid
import pprint
import json

def lambda_handler(event, context):

    print('Event object')
    body = json.loads(event["body"])
    recordId = str(uuid.uuid4())
    voice = body["voice"]
    text = body["text"]

    print('Generating new DynamoDB record, with ID: ' + recordId)
    print('Input Text: ' + text)
    print('Selected voice: ' + voice)

    #Creating new record in DynamoDB table
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(os.environ['DB_TABLE_NAME'])
    table.put_item(
        Item={
            'id' : recordId,
            'text' : text,
            'voice' : voice,
            'status' : 'PROCESSING'
        }
    )

    #Sending notification about new post to SNS
    client = boto3.client('sns')
    client.publish(
        TopicArn = os.environ['SNS_TOPIC'],
        Message = recordId
    )

    return {
        'statusCode': '200',
        'headers': {},
        'body': recordId
    }
