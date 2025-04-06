const express = require("express");
const Router = express.Router();
const { autoSignin } = require("./auth");
const pool = require("../model/pool");
const RESPONSE_MESSAGES = require("../utils/responses");

Router.post("/journal", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});

module.exports = Router;
