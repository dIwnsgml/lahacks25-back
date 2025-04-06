const express = require("express");
const Router = express.Router();
const { autoSignin } = require("./auth");
const pool = require("../model/pool");
const RESPONSE_MESSAGES = require("../utils/responses");

Router.get("/journal", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const { journal_id } = req.query;

      const connection = pool.promise();
      const [messages] = await connection.query(
        `SELECT message_id, user_id, message FROM messages WHERE journal_id = ?`,
        [journal_id]
      );

      console.log("journal", journal_id, req.query);

      res.status(200).send({
        success: true,
        status: 200,
        data: {
          messages,
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
