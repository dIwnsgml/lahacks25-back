const express = require("express");
const Router = express.Router();
const { autoSignin } = require("./auth");
const pool = require("../model/pool");
const RESPONSE_MESSAGES = require("../utils/responses");
const Together = require("together-ai");

const client = new Together({
  apiKey: process.env.AI_API_KEY,
});

Router.post("/journal", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const connection = pool.promise();
      const [[userInfo]] = await connection.query(
        `SELECT user_id, name, email, is_admin FROM users WHERE user_id = ?`,
        [userId]
      );

      if (!userInfo) {
        const response = RESPONSE_MESSAGES.noUser();
        return res.status(response.status).send(response);
      }

      const { journal } = req.body;

      console.log("original journal", journal);

      const response = await client.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a compassionate and empathetic therapist, trained to provide thoughtful, supportive, and reflective responses to journal entries. Your tone should be gentle, non-judgmental, and insightful, helping the user reflect on their emotions and thought patterns.",
          },
          {
            role: "user",
            content: `Here is the journal entry written by ${userInfo.name}: \n\n"${journal}"\n\nPlease offer a compassionate and empathetic response, encouraging reflection and providing insightful questions to help ${userInfo.name} explore their feelings and thoughts further. Your response should offer guidance but also leave space for the user to reflect on their own emotions.`,
          },
        ],
        model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
        temperature: 0.7, // Encourages more creativity while maintaining relevance
        max_tokens: 500, // Ensure the response can be sufficiently detailed
        stop: ["\n"], // Define a stop sequence to prevent excessive output
      });

      const therapistResponse = response.choices[0].message.content;
      console.log(therapistResponse);

      const comment = response.choices[0].message.content;

      res.status(200).send({
        success: true,
        status: 200,
        data: {
          comment,
        },
      });
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});

module.exports = Router;
