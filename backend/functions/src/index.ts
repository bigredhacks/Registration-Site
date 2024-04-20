import * as functions from 'firebase-functions';
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import ServiceAccount from '../service-account.json';

// initialize firebase in order to access its services
admin.initializeApp({ credential: admin.credential.cert(JSON.stringify(ServiceAccount)) });

//initialize express server
const app = express();
app.use(express.json());
app.use(cors());

const db = admin.firestore();

exports.api = functions.https.onRequest(app);

export { db };