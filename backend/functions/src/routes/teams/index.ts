import express, {Request, Response} from 'express';
import {db} from "../../index"
import {isTeam} from "./types"

const teams = express.Router()

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
 * Creates a new team
 * 
 * Requires teamName attribute
 * Requires owner attribute
 */
teams.post("/", catchAll(async (req, res) => {
  const data = req.body;

  // Validate form data
  if (!isTeam(data)) {
    res.status(400).send({
      error: "Requested team must have name and owner attribute"
    }); return;
  }

  try {
    let docRef = await db.collection('teams').doc(data.name).get();

    if (docRef.exists) {
      res.status(400).send({
        error: `Team with name: ${data.name} already exists.`
      });
      return;
    }
  } catch (e: any) {
    res
      .status(500)
      .send({ error: `Problem with team validation. ${e.message}` });
  }

  try {
    await db
      .collection('teams')
      .doc(data.name)
      .set({ owner: data.owner, members: [data.owner] });
  } catch (e: any) {
    res.status(400).send({ error: `Could not create team. ${e.message}` });
    return;
  }

  res.sendStatus(200);
}))

/**
 * Adds a member to a team
 */
teams.put(
  '/member',
  catchAll(async (req, res) => {

  })
);

/**
 * Changes the owner of a team. Can only be fulfilled by a team owner. Need auth to do this.
 */
teams.put(
  '/changeOwner',
  catchAll(async (req, res) => {})
);

/**
 * Gets a team's data based off of its team. Requires auth again.
 */
teams.get(
  '/',
  catchAll(async (req, res) => {})
);

/**
 * Deletes a team. Requires auth
 */
teams.delete("/", catchAll(async (req, res) => {

}))

/**
 * Deletes a member from a team. Requires auth.
 */
teams.delete("/member", catchAll(async (req, res) => {

}))

export default teams