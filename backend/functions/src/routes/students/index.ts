import express, { Request, Response } from 'express';
import { db } from '../../index';
// import { CollectionReference, Query } from 'firebase-admin/firestore';
import {student, isEmailedStudent} from "./types"
import { Query } from 'firebase-admin/database';
import { CollectionReference } from 'firebase-admin/firestore';

const students = express.Router();

// TODO: Convert to middleware
function catchAll(
  func: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response) => {
    try {
      await func(req, res);
    } catch (e: any) {
      res.status(500).send(e.message);
    }
  };
}

/**
 * Creates a new student in the `students` collection using x-www-form-urlencoded data.
 *
 * Upon success returns the document ID with HTTP 202
 * Upon fail returns HTTP 400
 */
students.post('/', catchAll(async (req, res) => {
  let studentData = req.body;

  // Validate form data
  if (!isEmailedStudent(studentData)) {
    res.status(400).send({
      error:
        'Malformed student registration request. Missing some required fields.',
    });
    return;
  }

  // Check email not in database already
  try {
    let docRef = await db.collection('students').doc(studentData.email).get();

    if (docRef.exists) {
      res.status(400).send({
        error: `Student with email: ${studentData.email} already exists.`,
      });
      return;
    }
  } catch (e) {
    res.status(500).send({ error: `Problem with email validation.` });
  }

  // Create student with email
  try {
    await db.collection('students').doc(studentData.email).set(studentData);
  } catch (e) {
    res.status(400).send({ error: 'Could not create student.' });
    return;
  }

  res.sendStatus(200);
}));

/**
 * Updates a student with new parameters. Does not support updating arrays yet.
 */
students.put('/:email', catchAll(async (req, res) => {
  let email = req.params.email;
  let studentData = req.body;

  // Check that email field exists on req.body
  if (!isEmailedStudent(studentData)) {
    res.status(404).send({
      error: 'Student email not specified.',
    });
    return;
  }

  // Update the database
  try {
    await db
      .collection('students')
      .doc(email)
      // @ts-ignore
      .update(studentData);
  } catch (e) {
    res.status(404).send({
      error: `Student with email: ${email} could not be updated.`,
    });
    return;
  }

  res.sendStatus(200);
}));

/**
 * Retrives all students.
 */
students.get('/', catchAll(async (req, res) => {
  let collectionRef: CollectionReference | Query = db.collection('students');
  
  // Evaluate filters placed on GET
  let filters: student = req.query;
  Object.entries(filters).forEach(([key, value]) => {
    // @ts-ignore
    collectionRef = collectionRef.where(key, "==", value);
  });

  let snapshotRef = await collectionRef.get();

  let addedData: Map<string, student> = new Map();
  snapshotRef.forEach((doc) => {
    addedData.set(doc.id, doc.data() as student);
  });

  res.status(200).send(Object.fromEntries(addedData));
}));

/**
 * Retrieves student with specificed `email` param.
 * Eg. GET /students/jrh382@cornell.edu
 */
students.get('/:email', catchAll(async (req, res) => {
  let email = req.params.email;

  let collectionRef = db.collection('students');
  let docRef = await collectionRef.doc(email).get();

  if (docRef.exists) {
    res.status(200).send({[email]: docRef.data()});
  } else {
    res
      .status(404)
      .send({ error: `Could not get data from email: ${email}` });
  }
}));

/**
 * Deletes student from the students collection.
 */
students.delete('/:email', catchAll(async (req, res) => {
  let email = req.params.email;
  let collectionRef = db.collection('students');

  // Handle when email not specified
  if (email == '') {
    res.status(400).send({ error: 'Email must be specified.' });
    return;
  }

  try {
    await collectionRef.doc(email).delete();
  } catch (e) {
    res.status(404).send({ error: `Cannot find email: ${email}` });
    return;
  }

  res.status(200).send(`Successfully deleted: ${email}`);
}));

export default students;
