#!/usr/bin/env node
import cdk = require('@aws-cdk/cdk');
import { PollyNotesReaderStack } from '../lib/polly-notes-reader-stack';

const app = new cdk.App();
new PollyNotesReaderStack(app, 'PollyNotesReaderStack');
app.run();
