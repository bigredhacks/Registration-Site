import { Response } from 'express';
import {
  CollectionReference,
  DocumentData,
  UpdateData,
} from 'firebase-admin/firestore';

/**
 * Retrieves the entry with id [id] from [collection] in the Firestore database
 * and sends the entry in an HTTP response. Sends the appropriate error to the
 * client if the request is unsuccessful
 *
 * @param res the response object that will be sent to the client
 * @param collection the collection to retrieve the entry from
 * @param id the unique identifier of the entry to retrieve (usually the name of the document)
 * @param callback an optional callback function to further process the retrieved data before sending.
 */
export async function getById(
  res: Response,
  collection: CollectionReference,
  id: string,
  callback: (value: DocumentData) => any = (id) => id
): Promise<void> {
  try {
    const snapshot = await collection.doc(id).get();

    if (!snapshot.exists) {
      res.status(400).send({
        error: `${id} not found in ${collection.id}`,
      });
      return;
    }

    let data = callback(snapshot.data()!);

    res.status(200).send(data);
  } catch (err: any) {
    res.status(400).send({ error: err.message });
  }
}

/**
 * Retrieves all documents from the collection [collection] and sends all entries
 * in an HTTP response
 *
 * @param res the response object that will be sent to the client
 * @param collection the collection to retrieve the entry from
 * @param callback an optional callback function to further process the reference, i.e make queries, and returns the data to be sent.
 */
export async function getAll(
  res: Response,
  collection: CollectionReference,
  callback?: (value: CollectionReference) => any
): Promise<void> {
  try {
    const docSnapshots = (await collection.get()).docs;

    let data = undefined;

    if (callback) {
      data = callback(collection);
    } else {
      data = await Promise.all(docSnapshots.map(async (doc) => doc.data()));
    }

    res.status(200).send(data);
  } catch (err: any) {
    res.status(400).send({ error: err.message });
  }
}

export async function update(
  res: Response,
  collection: CollectionReference,
  id: string,
  updates: UpdateData<any>,
  callback?: (value: any) => void
) {
  try {
    const collectionRef = collection.doc(id);
    await collectionRef.update(updates);

    if (callback) {
      callback(collectionRef);
      return;
    }

    res.status(200).send('Successful Update');
  } catch (err: any) {
    res.status(400).send({ error: err.message });
  }
}

export async function create(
  res: Response,
  collection: CollectionReference,
  id: string,
  contents: any,
  callback?: (value: any) => void
) {
  try {
    const docRef = await collection.doc(id);

    if ((await docRef.get()).exists) {
      res.status(400).send({
        error: `document with ${id} already exists in ${collection.id}`,
      });
      return;
    }

    docRef.set({ contents });

    if(callback){
      callback(docRef)
    }

    res.status(200).send('Successful Create');
  } catch (err: any) {
    res.status(400).send({ error: err.message });
  }
}

export async function deleteById(
  res: Response,
  collection: CollectionReference,
  id: string,
  callback?: (value: any) => void
) {
  try {
    const docRef = await collection.doc(id);

    if (!(await docRef.get()).exists) {
      res.status(400).send({
        error: `document with ${id} doesn't exist in ${collection.id}`,
      });
      return;
    }

    await docRef.delete();
    res.status(200).send('Successful Delete');
  } catch (err: any) {
    res.status(400).send({ error: err.message });
  }
}
