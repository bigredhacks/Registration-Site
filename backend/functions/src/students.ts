import express from 'express';
import { firebaseApp } from './index';

const students = express();

interface student {
  firstName: string;
  lastName: string;
  gradYear: number;
  misc?: object;
}

function isStudent(data: object): data is student {
  return 'firstName' in data && 'lastName' in data && 'gradYear' in data;
}

// TODO: use express-validator middleware

/**
 * Creates a new student in the `registrants` collection using x-www-form-urlencoded data.
 * 
 * Upon success returns the document ID with HTTP 202
 * Upon fail returns HTTP 400
 */
students.post('/register', async (req, res) => {
  let studentData = req.body;

  if (!isStudent(studentData)) {
    res.status(400).send('Malformed student registration request.');
    return;
  }

  // When a student is registered it should send the document ID of the newly created student
  let ref = await firebaseApp
    .firestore()
    .collection('registrants')
    .add(studentData);

  res.status(202).send(ref.id);
});

students.put('/updateStudent', async (req, res) => {});

students.get('/query', async (req, res) => {});

students.get('/queryAll', async (req, res) => {});

export default students;
