/*
**
** Copyright (c) 2024 Oracle and/or its affiliates
** Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl/

* @description A very simple backend server to authenticate to OCI Services.
*
* Written in TypeScript using express-js, this acts as an minimal working example of
* a server hosted by a customer.
*
* The primary purpose of this server is to accept realtime session authentication
* requests from customer's frontend application and communicate with OCI Speech Service's
* `createRealtimeSessionToken` API to generate a JWT which can be used by the frontend to
* create a direct websocket connection to OCI Realtime Speech Service
*
* It will be customer's responsibility to handle Authentication and Authorization
* between the customer's frontend application and customer's server. In case no AuthN/Z
* mechanism is put in place, any client which hits their endpoint may be able to get a
* JWT generated on the customer's expense.
*
* @tutorial
* OCI Typescript SDK getting started guide -
* https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/typescriptsdkgettingstarted.htm
*
* OCI AI Speech Realtime Session Token Generation -
* https://docs.oracle.com/en-us/iaas/api/#/en/speech/20220101/RealtimeSessionToken/CreateRealtimeSessionToken
**/

import express from "express";
import * as common from "oci-common";
import * as aispeech from "oci-aispeech";
import bodyParser from "body-parser";

const app = express();
const cors = require("cors");
const path = require("path");
const port = 8448;

app.use(cors());

// The OCID of the compartment that will be used for authentication and authorization
const compartmentId = "<compartment-id>";

// Set the region where you want to use the services
const region = "<region>" // e.g. "us-phoenix-1";

const provider: common.SessionAuthDetailProvider = new common.SessionAuthDetailProvider("~/.oci/config", "DEFAULT");

/**
 * Generates a real-time session token using Oracle Cloud Infrastructure (OCI) AI Speech Service.
 *
 * This function configures the OCI client using a specified region and compartment ID, and
 * then sends a request to generate a real-time session token for the AI Speech Service.
 *
 * @async
 * @function
 *
 * @returns {Promise<string>} The real-time session token generated by the AI Speech Service.
 *
 * @throws {Error} If the request to generate the session token fails.
 */
async function getRealtimeToken() {
  // Use the AuthDetailsProvider suited for your use case.
  // Read more at - https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdk_authentication_methods.htm

  provider.setRegion(region);

  // Initialize the OCI AI Speech API Client
  const speechClient = new aispeech.AIServiceSpeechClient({ authenticationDetailsProvider: provider });

  // Create a request and dependent object(s).
  const createRealtimeSessionTokenDetails = {
    compartmentId: compartmentId,
  };

  const createRealtimeSessionTokenRequest: aispeech.requests.CreateRealtimeSessionTokenRequest = {
    createRealtimeSessionTokenDetails: createRealtimeSessionTokenDetails,
  };

  // Send request to the Client.
  const createRealtimeSessionTokenResponse = await speechClient.createRealtimeSessionToken(createRealtimeSessionTokenRequest);

  console.log("Token generated: ", createRealtimeSessionTokenResponse);
  return createRealtimeSessionTokenResponse.realtimeSessionToken;
}

app.use(bodyParser.json());

/**
 * Handles the `/authenticate` GET request. This route initiates the process of
 * obtaining a real-time token by calling the `getRealtimeToken` function.
 *
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 *
 * @returns {void}
 * @throws {Error} If the token retrieval fails.
 */
app.get("/authenticate", (req, res) => {
  getRealtimeToken()
    .then((response) => {
      console.log("Response: ", response);
      res.send(response);
    })
    .catch((error) => {
      console.log("createRealtimeSessionToken Failed with error " + error);
      res.status(401);
      res.send(error);
    });
});

/**
 * Handles the `/region` GET request. This route responds with the current region.
 * Use this call to ensure the frontend uses the same region as the server.
 *
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 *
 * @returns {void}
 */
app.get("/region", (req, res) => {
  res.send({ region: region });
});

/**
 * Starts the Express server and listens on the specified port.
 *
 * @param {number} port - The port number on which the server will listen.
 * @param {() => void} [callback] - Optional callback function that is invoked after the server starts listening.
 *
 * @returns {void}
 */
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});