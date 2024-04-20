import express, { Request, Response } from 'express';
import { db } from '../../index';


const adminSettings = express.Router();

interface adminSettings {
  hackathonDate: string;
  signupDate: string;
  acceptedText: string;
  waitlistText: string;
  confirmationText: string;
}

function isAdmin(data: object): data is adminSettings {
  return (
    'hackathonDate' in data &&
    'signupDate' in data &&
    'acceptedText' in data &&
    'waitlistText' in data && 
    'confirmationTest'in data
  );
}

// catch all method
function catchAll(func: (req: Request, res: Response) => Promise<void>): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response) => {
    try {
      await func(req, res);
    } catch (e: any) {
      res.status(500).send(e.message);
    }
  }
}

/* 
* Bulk updates admin with new data 
*/
adminSettings.post('/', catchAll(async (req, res) => {
  let adminData = req.body;

  if (!isAdmin(adminData)) {
    res.status(400).send({
      error: 'Malformed admin data.'});
    return;
  }

  try {
    await db
      .collection('admin')
      .doc('info')
      // @ts-ignore
      .update(adminData);
  } catch (e) {
    res.status(415).send({
      error: 'Could not update admin information.' });
    return; 
  }

  res.sendStatus(200);
}));

/**
 * Retrieves admin information
 */
adminSettings.get('/', catchAll(async (req, res) => {
  try {
    const docRef = await db.collection('admin').doc('info').get(); 
    if (docRef.exists) {
      res.status(200).json("hello");
      // docRef.data()
    } else {
      res.status(404).send({ error: 'Admin information not found.' });
    }
  } catch (e) {
    res.status(500).send({ error: 'Error retrieving admin information.' });
  }
}));

export default adminSettings;