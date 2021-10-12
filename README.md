# poc-gke-token-exchange

```
npm install
node src/index.js --provider-pool='<your-pool>' \
                  --provider-id='<your-provider-id>' \
                  --service-account-email='<your-service-account-email>' \
                  --account-number='<your-account-number>'
```

```
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_SESSION_TOKEN="your-session-token"
```
^if the script fails

Resources:

* https://scalesec.com/blog/access-gcp-from-aws-using-workload-identity-federation/
* https://cloud.google.com/iam/docs/using-workload-identity-federation#gcloud_1
* https://medium.com/google-cloud/exchange-aws-credentials-for-gcp-credentials-using-gcp-sts-service-88dd40c1f68c
