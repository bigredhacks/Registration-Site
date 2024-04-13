import * as functions from 'firebase-functions';
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';

import students from './routes/students/index';

//import bodyParser from 'body-parser';

const serviceAccount: string = require('../service-account.json');
// import ServiceAccount from '../service-account.json';

// initialize firebase in order to access its services
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

//initialize express server
const app = express();
app.use(express.json());
app.use(cors());

app.use("/students", students)

const db = admin.firestore();

exports.api = functions.https.onRequest(app);

export { db };