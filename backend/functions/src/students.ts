import express from 'express';

const students = express();
// TODO: use express-validator middleware

students.post('/register', async (req, res) => {});

students.put("/updateStudent", async (req, res) => {});

students.get("/query", async (req, res) => {});

students.get("/queryAll", async (req, res) => {});

export default students;