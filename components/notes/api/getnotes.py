import boto3
import os
from boto3.dynamodb.conditions import Key, Attr

def lambda_handler(event, context):
    
    noteId = event["noteId"]
    
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(os.environ['DB_TABLE_NAME'])
    
    if noteId=="*":
        items = table.scan()
    else:
        items = table.query(
            KeyConditionExpression=Key('id').eq(noteId)
        )
    
    return items["Items"]