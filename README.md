# NR-Auto-Ingest-Clamp

`npm install`
Install the dependencies - express, dotenv, axios, nodemon. Noodemon and dotenv are only used when running locally.

`npm start`
Start the app

> `nodemon start` - have live changes automagically applied. Use this in dev.

## Endpoints:

### Health check
`/healthy`
Elastic Beanstalk will check here the app is running.

### Set new rule
`/setDropRule?accountID=12345&description=hello world&rule=SELECT * FROM Log WHERE message LIKE '%creditcard:%'`
Pass in parameters to set new rules

This app is designed to be hit by an API, and most likely through a webhook via New Relic Alerts.

> `accountID` : set this to the account ID to apply a new rule to. The user API key you are using in envars must have access to do this, and to that account ID. 
The account must also be in the region that you specified the NerdGraph GraphQL endpoint.

> `description` : give some meaningful description to what the rule is, what it is doing. The rule will automatically be prepended with *AUTO_APPLIED_RULE* 
so you can tell the rules that have been added using this app. This string is also what the cleanup function will check for before removing rules, so rules without
this will not be removed.

> `rule` : this needs some valid NRQL that is compatible with the data drop mutation. [Learn more here](https://docs.newrelic.com/docs/telemetry-data-platform/manage-data/drop-data-using-nerdgraph/#restrictions)

### Cleanup rules
`/cleanRules`
Hit this endpoint to remove all of the auto applied rules (ideally, run on a cron job at the relevant times).

## Environment variables
`PORT` - *optional*. This is the port the app will run on. Elastic Beanstalk will automatically set this. The app will automatically run on port 3000 if this is not set.

`NewRelicAPIKey` - **required**. Provide a [New Relic User API key](https://docs.newrelic.com/docs/apis/intro-apis/new-relic-api-keys/#user-api-key).

`NerdGraphEndPoint` - **required**. Most accounts will be using the global (US) region. If yoou are using another region such as EU region, set this endpoint to that.
You can find the endpoints [here](https://docs.newrelic.com/docs/using-new-relic/welcome-new-relic/get-started/our-eu-us-region-data-centers/#endpoints).

`globalAccountID` - **required**. Global here means for this app, it isn't a New Relic term. Set this to be the default account ID for this app.

## Deploying to Elastic Beanstalk
You can actually just zip up the modules, server.js and package.json and deploy this to the latest Node environment in elastic beanstalk. 
The smallest instance size is fine - mine runs on the free tier.

## Security
The app needs tightening for production-use. This is important because a bad actor could totally stop ingest into your New Relic account.

### Limit IP access
New Relic Alerts Webhooks have an IP address pool [you can find here](https://docs.newrelic.com/docs/using-new-relic/cross-product-functions/install-configure/networks/#webhooks). 
You should limit inbound access to this IP pool.

### Basic Auth
New Relic Alerts Webhooks also support basic auth. You could use the package `express-basic-auth` to implement such. This is easy to do, [see their docs on npm](https://www.npmjs.com/package/express-basic-auth).

## Example NR Alert Policy

> Remember that NR notification channels are at a policy level, not condition. So you will need to have many separate policies to prevent the different conditions setting off one anothers clamping webhooks. So for instance a "Prometheus Clamp policy" will map into a "prometheus clamp webhook", a "Logs Clamp policy" into a "logs clamp webhook" so you will need to create a fair few policies and notification channels because of this design.

1. NRQL based condition: `SELECT nativesizeestimate() from Log` -> will return size in bytes You could do `SELECT nativesizeestimate()/1e+9 from Log` to have this return a GB number if you have wider logs usage than my sample account. You could also use other events such as the `NrConsumption` table which tracks at an hourly basis.

2. You should then set a critical threshold to be the level you wish to introduce the clamp. NR Alerts will only send a notification to a webhook at the critical threshold, so keep that in mind that the warning level won't trigger any notification channels.

3. Set a notification channel for this. Mine looks like `http://myclampingapp.elasticbeanstalk.com/setDropRule?accountID=1147177&description=i am testing&rule=SELECT * FROM Log WHERE app = 'garySpencer'`
