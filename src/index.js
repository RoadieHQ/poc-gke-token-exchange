import fs from "fs";
import yargs from "yargs";
import AWS from 'aws-sdk';
import fetch from 'node-fetch';
import { hideBin } from 'yargs/helpers';
import logger from './logger.js';

const DEFAULT_REGION = 'eu-west-1';

async function createRequest(){
  const region = DEFAULT_REGION;
  const url = `https://sts.${region}.amazonaws.com`;
  const endpoint = new AWS.Endpoint(url);
  const request = new AWS.HttpRequest(endpoint, region);

  request.method = 'POST';
  request.headers['host'] = endpoint.hostname;
  request.path = '/?Action=GetCallerIdentity&Version=2011-06-15';
  request.headers['Content-Type'] = 'application/plain-text';

  const credentials = new AWS.EnvironmentCredentials('AWS');
  const signer = new AWS.Signers.V4(request, 'sts');
  signer.addAuthorization(credentials, new Date());

  return request;
}

const storeData = (data, path) => {
  try {
    fs.writeFileSync(path, JSON.stringify(data));
  } catch (err) {
    console.error(err);
  }
};

const generateTokenPayload = (data, args) => {
  const headers = [
    {
      "key":"Authorization",
      "value": data.headers['Authorization']
    },
    {
      "key":"host",
      "value": data.headers['host']
    },
    {
      "key":"x-amz-date",
      "value":data.headers['X-Amz-Date']
    },
    {
      "key":"x-goog-cloud-target-resource",
      "value":`//iam.googleapis.com/projects/${args.accountNumber}/locations/global/workloadIdentityPools/${args.providerPool}/providers/${args.providerId}`
    },
    {
      "key":"x-amz-security-token",
      "value": data.headers['x-amz-security-token']
    }
  ]
  return JSON.stringify(
    {
      "headers": headers,
      "method": "POST",
      "url": `${data.url}`
    }    
  )
}

const generatePayload = (token) => {
  return JSON.stringify({
    audience : `//iam.googleapis.com/projects/${args.accountNumber}/locations/global/workloadIdentityPools/${args.providerPool}/providers/${args.providerId}`,
    grantType : "urn:ietf:params:oauth:grant-type:token-exchange",
    requestedTokenType : "urn:ietf:params:oauth:token-type:access_token",
    scope : "https://www.googleapis.com/auth/cloud-platform",
    subjectTokenType : "urn:ietf:params:aws:token-type:aws4_request",
    subjectToken: token
  })
}

const getAccessToken = async (data, args) => {
//   STS_TOKEN=$(curl -0 -X POST https://sts.googleapis.com/v1/token \
//     -H 'Content-Type: text/json; charset=utf-8' \
//     -d @- <<EOF | jq -r .access_token
//     {
//         "audience"           : "//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID",
//         "grantType"          : "urn:ietf:params:oauth:grant-type:token-exchange",
//         "requestedTokenType" : "urn:ietf:params:oauth:token-type:access_token",
//         "scope"              : "https://www.googleapis.com/auth/cloud-platform",
//         "subjectTokenType"   : "$SUBJECT_TOKEN_TYPE",
//         "subjectToken"       : "$SUBJECT_TOKEN"
//     }
// EOF)

  const serializedTokenPayload = generateTokenPayload(data, args);
  // console.log(encodeURIComponent(JSON.stringify(serializedTokenPayload)))
  const payload = generatePayload(encodeURIComponent(serializedTokenPayload), args);
  // console.log(JSON.stringify(JSON.parse(payload),null,2));
  return await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST", 
    body: payload,
    headers: {
      'Content-Type': 'text/json; charset=utf-8'
    }
  }).then(res => {
    return res.json()
  }).then((res) => {
    // console.log(JSON.stringify(res))
    return res.access_token
  }
  ).catch((err) => {
    console.log(`There was an error ${err}`)
  });
}

const getOauthToken = async (token, args)=> {
//   ACCESS_TOKEN=$(curl -0 -X POST https://iamcredentials.googleapis.co`m/v1/projects/-/serviceAccounts/SERVICE_ACCOUNT_EMAIL:generateAccessToken \
//     -H "Content-Type: text/json; charset=utf-8" \
//     -H "Authorization: Bearer $STS_TOKEN" \
//     -d @- <<EOF | jq -r .accessToken
//     {
//         "scope": [ "https://www.googleapis.com/auth/cloud-platform" ]
//     }
// EOF)
// echo $ACCESS_TOKEN

const email = args.serviceAccountEmail.replace('@', '%40');
return await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${email}:generateAccessToken`, {
    method: "POST",
    headers: {
      'Content-Type': 'text/json; charset=utf-8',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({"scope": [ "https://www.googleapis.com/auth/cloud-platform" ]})
  }).then(res => {
    return res.json()
  }).then( (res) => {
    // console.log(JSON.stringify(res))
    return res.accessToken
  }).catch((err) => {
    console.log(`There was an error ${err}`)
  });
}

const runSts = async (args) => {
  const signedRequest = await createRequest(args.region);
  const transformed = {
    url: `https://${signedRequest.endpoint.hostname}/?${signedRequest.search()}`,
    headers: signedRequest.headers,
    body: signedRequest.body,
  };
  storeData(transformed, "./request.json");

  const accessToken = await getAccessToken(transformed, args);
  const oauth = await getOauthToken(accessToken, args);
  console.log(`This is your oauth token: ${oauth}`)
};

const HELP = "This is a script to exchange AWS tokens for GCP tokens"

const getArgs = (argv) => {
  let args = {}
  
  if(!argv.providerPool){
    logger.error(`${HELP}\nYou must set --provider-pool=[your pool]`);
    process.exit(2);
  }
  args.providerPool = argv.providerPool;

  if(!argv.serviceAccountEmail){
    logger.error(`${HELP}\nYou must set --service-account-email=[your service account email]`)
    process.exit(2);
  }
  args.serviceAccountEmail = argv.serviceAccountEmail;

  if(!argv.providerId){
    logger.error(`${HELP}\nYou must set --provider-id=[your pool id]`)
    process.exit(2);
  }
  args.providerId = argv.providerId;

  if(!argv.accountNumber){
    logger.error(`${HELP}\nYou must set --account-number=[your account number]`)
    process.exit(2);
  }
  args.accountNumber = argv.accountNumber;
  args.region = argv.region || DEFAULT_REGION;
  return args;
}

const argv = yargs(hideBin(process.argv)).argv
const args = getArgs(argv);
runSts(args);
