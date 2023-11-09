import * as functions from 'firebase-functions'
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
//import bodyParser from 'body-parser';
const serviceAccount: string = require('../service-account.json')

// initialize firebase inorder to access its services
admin.initializeApp({credential: admin.credential.cert(serviceAccount)});

//initialize express server
const app = express()
app.use(express.json())
app.use(cors())

exports.api = functions.https.onRequest(app)