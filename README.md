# Polly Notes Reader Lambda Website (via AWS CDK)

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

 This will attempt to recreate the ACloudGuru Polly Notes Reader as a CDK stack.

## Current Hacks Around CDK

1. CDK has incomplete support for setting up the following, so they will need to be *sigh* manually set up after deployment, for now.
   1. Method request: Add a query string parameter: 'noteId'
   2. Integration request: Add a mapping template, as per the file `reference/mappings.json`
   3. Method response: Add a response mapping for 200, including CORS response headers
   4. Integration response: Add a passthrough response mapping for 200, including CORS response headers
   5. CORS support is being done by not including an OPTIONS method in the template, and enabling CORS support via the console.
2. Pushing the web content to the static website S3 bucket, after the CloudFormation deployment succeeds, is not supported. So we will either manually upload it, or create a shell script to run the CDK deploy, followed by an S3 sync to the bucket.

*Note* If we add Route53 support, perhaps we can at least avoid the need for CORS