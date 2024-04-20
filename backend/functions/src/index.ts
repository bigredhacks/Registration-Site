import * as functions from 'firebase-functions';
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
// import ServiceAccount from '../service-account.json';

import adminSettings from "./routes/adminSettings/index"; 
const ServiceAccount : string = require('../service-account.json');

// initialize firebase in order to access its services
admin.initializeApp({ credential: admin.credential.cert(ServiceAccount) });

//initialize express server
const app = express();
app.use(express.json());
app.use(cors());
app.use("/adminSettings", adminSettings)

const db = admin.firestore();

exports.api = functions.https.onRequest(app);

export { db };