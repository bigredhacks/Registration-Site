import Event from "../models/Event";
import FormLayoutModel from "../models/FormLayout";
import { Request, Response } from "express";
import { errorMessage, serverErrorMessage } from "../utils/resMessages";

/**
 * Fetches all events.
 * 
 * GET: /events/
 * 
 * If successful, returns 200 OK with JSON array of all events.
 * If an error occurs, returns 500 Internal Server Error with error message.
 */
export const getAllEvents = async (req: Request, res: Response) => {
  try {
    const events = await Event.find(); // fetch all form types
    res.status(200).json(events);
  } catch (err: any) {
    res.status(500).json(errorMessage(err)); 
  }
}

/**
 * Fetches a form type by ID.
 * 
 * GET: /events/:id
 * 
 * If successful, returns 200 OK with JSON of the layout.
 * If the event is not found, returns 404 Not Found with error message.
 * If an error occurs, returns 500 Internal Server Error with error message.
 */
export const getEventById = async (req: Request, res: Response) => {
  try {
    const event = await Event.findById(req.params.id); // fetch event by id
    if (!event) {
      res.status(404).json(errorMessage("Event not found"));
      return
    }
    res.status(200).json(event);
  } catch (err: any) {
    res.status(500).json(serverErrorMessage(err)); 
  }
}

/**
 * Creates a new event.
 * 
 * POST: /events/
 * 
 * Request body: Refer to API Docs for required fields.
 * 
 * If successful, returns 201 Created with JSON of the created events.
 * If request body does not match specification (missing fields), returns 400 Bad Request with error message.
 * If the event id is not found, returns 404 Not Found with error message.
 * If an error occurs, returns 500 Internal Server Error with error message.
 */
export const createEvent = async (req: Request, res: Response) => {
  try {
    const layoutId = req.body.layoutId;
    const layout = await FormLayoutModel.findById(layoutId); // fetch layout by id
    if (!layout) {
      res.status(404).json(errorMessage("Form layout not found"));
      return
    }
    const event = new Event(req.body); // create new Event
    await event.save();
    res.status(201).json(event);
  } catch (err: any) {
    res.status(500).json(serverErrorMessage(err));
  }
}

/**
 * Updates an event by ID.
 * 
 * PATCH: /events/:id
 * 
 * Request body: Refer to API Docs for fields that can be updated.
 * 
 * If successful, returns 200 OK with JSON of the updated events.
 * If the event id is not found, returns 404 Not Found with error message.
 * If an error occurs, returns 500 Internal Server Error with error message.
 */
export const updateEvent = async (req: Request, res: Response) => {
    try {
      const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); 
      if (!event) {
        res.status(404).json(errorMessage("Form layout not found"));
        return
      }
      res.status(200).json(event);
    } catch (err: any) {
      res.status(500).json(serverErrorMessage(err)); 
    }
}

/**
 * Deletes an event by ID.
 * 
 * DELETE: /events/:id
 * 
 * If successful, returns 200 OK with JSON of the deleted event.
 * If the event is not found, returns 404 Not Found with error message.
 * If an error occurs, returns 500 Internal Server Error with error message.
 */
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const deletedEvent = await Event.findByIdAndDelete(req.params.id); // delete layout by id
    if (!deletedEvent) {
      res.status(404).json(errorMessage("Event not found"));
      return
    }
    res.status(200).json(deletedEvent);
  } catch (err) {
    res.status(500).json(serverErrorMessage(err));
  }
}
