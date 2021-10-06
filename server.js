require('dotenv').config({ path: 'app.env' });
const axios = require("axios");
const express = require('express');
const app = express();
let NewRelicAPIKey = process.env.NewRelicAPIKey;
let NerdGraphEndPoint = process.env.NerdGraphEndPoint;
let globalAccountID = process.env.globalAccountID;

// return healthy for ELB checks
app.all( '/health', (req, res) => {
    res.send( "healthy" );
  });

// create new drop rules
app.post('/setDropRule', (req, res) => {
    // take envars locally
    let graphMutationSanitised = graphMutation;
    let accountID = req.query.accountID;
    let description = 'AUTO_APPLIED_RULE: ' + req.query.description;
    let rule = req.query.rule;

    // modify the gql
    graphMutationSanitised = graphMutationSanitised.replace('<AccountID>', accountID);
    graphMutationSanitised = graphMutationSanitised.replace('<RuleDescription>', description);
    graphMutationSanitised = graphMutationSanitised.replace('<RuleNRQL>', rule);

    // prep and send the mutation
    axios({
        url: NerdGraphEndPoint,
        method: 'post',
        headers: {
            'API-Key': NewRelicAPIKey,
            'Content-Type': 'application/json'
        },
        data: {
            query: graphMutationSanitised
        }
        }).then((result) => {
        res.send(result.data)
    });
});

// list all the DD rules, and remove any prefixed with "AUTO_APPLIED_RULE"
app.all('/cleanRules', async(req, res) => {
    // use the globally set account ID here
    var listRulesSanitised = listRules.replace('<AccountID>', globalAccountID);

    // prepare and send the list query
    var data = JSON.stringify({
        query: listRulesSanitised
      });

      var config = {
        method: 'post',
        url: NerdGraphEndPoint,
        headers: { 
          'API-Key': NewRelicAPIKey, 
          'Content-Type': 'application/json'
        },
        data : data
      };

      axios(config)
        .then(function (response) {
            // capture all of the DD rules on the account
            var rules = response.data['data']['actor']['account']['nrqlDropRules']['list']['rules'];
            var rulesToRemove = []

            // enter a for loop for the auto applied rules
            for (let i = 0; i < rules.length ; i++){
                // if the rule is auto applied, set about removing it
                if(rules[i]['description'].startsWith("AUTO_APPLIED_RULE")){
                    console.log('will remove rule ', rules[i]['id']);
                    rulesToRemove.push(rules[i]['id']);

                    // modify the gql
                    var deleteMutationSanitised = deleteMutation.replace('<RulesArray>', rules[i]['id']);
                    deleteMutationSanitised = deleteMutationSanitised.replace('<AccountID>', globalAccountID);
                    
                    // prep and send the mutation to delete the rules
                    var data = JSON.stringify({
                        query: deleteMutationSanitised
                    });

                    var config = {
                        method: 'post',
                        url: NerdGraphEndPoint,
                        headers: { 
                            'API-Key': NewRelicAPIKey, 
                            'Content-Type': 'application/json'
                        },
                        data : data
                    };
                    
                    axios(config)
                    .then(function (response) {
                        console.log(JSON.stringify(response.data));
                    })
                    .catch(function (error) {
                        console.log(error);
                    });
                }
            }
        return res.send(rules);
        })
        .catch(function (error) {
        console.log(error);
        });
});

// mutation to create a new DD rule
const graphMutation = `
    mutation {
        nrqlDropRulesCreate(accountId: <AccountID>, rules: {action: DROP_DATA, description: "<RuleDescription>", nrql: "<RuleNRQL>"}) {
        failures {
            error {
            description
            reason
            }
        }
        successes {
            description
            action
        }
    }
}
`

// mutation to delete a DD rule
const deleteMutation = `mutation {
    nrqlDropRulesDelete(accountId: <AccountID>, ruleIds: <RulesArray>) {
      failures {
        error {
          description
          reason
        }
      }
      successes {
        description
        id
      }
    }
  }`

// query to list all DD rules
const listRules = `{
    actor {
      account(id: <AccountID>) {
        nrqlDropRules {
          list {
            rules {
              id
              description
              nrql
            }
          }
        }
      }
    }
  }`

// express config - use envars to set the port, ELB will automatically set this.
const port = process.env.PORT || 3000

const server = app.listen(port, function() {
    console.log("Server running at http://127.0.0.1:" + port + "/");
  });