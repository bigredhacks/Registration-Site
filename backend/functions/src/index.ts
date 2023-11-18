import * as functions from 'firebase-functions'
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';

import students from './routes/students/index';

//import bodyParser from 'body-parser';
const serviceAccount: string = require('../service-account.json')

// initialize firebase inorder to access its services
const firebaseApp = admin.initializeApp({credential: admin.credential.cert(serviceAccount)});

const app = express();

app.use(express.json());
app.use(cors());
app.use("/students", students)

exports.api = functions.https.onRequest(app)

export {firebaseApp};