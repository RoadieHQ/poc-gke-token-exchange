import fs from "fs";
import AWS from 'aws-sdk';
import fetch from 'node-fetch';

async function createRequest(){
  const url = 'https://sts.eu-west-1.amazonaws.com';
  const region = 'eu-west-1';
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

const generateTokenPayload = (data) => {
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
      "value":"//iam.googleapis.com/projects/163556754530/locations/global/workloadIdentityPools/roadiehq-aws-accounts/providers/roadiehq-dev"
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
    audience : "//iam.googleapis.com/projects/163556754530/locations/global/workloadIdentityPools/roadiehq-aws-accounts/providers/roadiehq-dev",
    grantType : "urn:ietf:params:oauth:grant-type:token-exchange",
    requestedTokenType : "urn:ietf:params:oauth:token-type:access_token",
    scope : "https://www.googleapis.com/auth/cloud-platform",
    subjectTokenType : "urn:ietf:params:aws:token-type:aws4_request",
    subjectToken: token
  })
}

const getAccessToken = async (data) => {
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

  const serializedTokenPayload = generateTokenPayload(data);
  console.log(encodeURIComponent(JSON.stringify(serializedTokenPayload)))
  const payload = generatePayload(encodeURIComponent(serializedTokenPayload));
  console.log(JSON.stringify(JSON.parse(payload),null,2));
  return await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST", 
    body: payload,
    headers: {
      'Content-Type': 'text/json; charset=utf-8'
    }
  }).then(res => {
    return res.json()
  }).then((res) => {
    console.log(JSON.stringify(res))
    return res.access_token
  }
  ).catch((err) => {
    console.log(`There was an error ${err}`)
  });
}

const getOauthToken = async (token)=> {
  console.log(token);
//   ACCESS_TOKEN=$(curl -0 -X POST https://iamcredentials.googleapis.co`m/v1/projects/-/serviceAccounts/SERVICE_ACCOUNT_EMAIL:generateAccessToken \
//     -H "Content-Type: text/json; charset=utf-8" \
//     -H "Authorization: Bearer $STS_TOKEN" \
//     -d @- <<EOF | jq -r .accessToken
//     {
//         "scope": [ "https://www.googleapis.com/auth/cloud-platform" ]
//     }
// EOF)
// echo $ACCESS_TOKEN

  return await fetch("https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/nic-test%40roadie-dev-283705.iam.gserviceaccount.com:generateAccessToken", {
    method: "POST",
    headers: {
      'Content-Type': 'text/json; charset=utf-8',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({"scope": [ "https://www.googleapis.com/auth/cloud-platform" ]})
  }).then(res => {
    return res.json()
  }).then( (res) => {
    console.log(JSON.stringify(res))
    return res.accessToken
  }).catch((err) => {
    console.log(`There was an error ${err}`)
  });
}

const runSts = async () => {
  const signedRequest = await createRequest();
  const transformed = {
    url: `https://${signedRequest.endpoint.hostname}/?${signedRequest.search()}`,
    headers: signedRequest.headers,
    body: signedRequest.body,
  };
  storeData(transformed, "./request.json");

  const accessToken = await getAccessToken(transformed);
  const oauth = await getOauthToken(accessToken);
  console.log(oauth)
};

runSts();
