const fs = require('fs');
const https = require('https');
const allSettled = require('promise.allsettled');

const config = require('./config.json');

const authHeaders = {
  'Authorization': `Basic ${Buffer.from(`${config.authUser}:${config.authPass}`).toString('base64')}`,
};

const ENV = process.env.ENV === 'production' ? 'production' : 'staging';

const tasks = {};

let input = '';
let issues = [];

if (!config.output) {
  config.output = 'list';
}

const getTaskInfo = id => {
  return new Promise((resolve, reject) => {
    https.get({
      host: config.apiHost,
      port: 443,
      path: `/rest/api/latest/issue/${id}`,
      headers: authHeaders,
    }, res => {
      let body = '';
      res.on('data', data => { body += data });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject();
          return;
        }
        let json;
        let task;
        try {
          json = JSON.parse(body);
        } catch (e) {
          reject();
          throw new Error('Error parsing JSON');
        }
        if (json && json.key && json.fields && json.fields.assignee && json.fields.assignee.displayName) {
          task = {
            assignee: json.fields.assignee.displayName,
            id: json.key,
            children: (json.fields.subtasks || []).map(subtask => subtask.key).filter(id => issues.includes(id)),
            summary: json.fields.summary,
          };
          tasks[json.key] = task;
        }
        resolve(task);
      });
      res.on('error', e => {
        reject();
        console.error(e);
      });
    });
  });
};

const init = () => {
  const lines = input.split("\n");
  issues = [...new Set(lines)].filter(issue => !!issue);

  allSettled(issues.map(getTaskInfo)).then(printFlatArr).catch((huh) => { /* It's fine. */  });
};

const printFlatArr = (flatArr) => {
  const exclude = [];
  const flat = flatArr.filter(obj => obj.status === 'fulfilled' && !!obj.value).map(obj => obj.value);

  flat.forEach(node => {
    if (node.children && node.children.length) {
      node.children.forEach(childId => {
        node.subtasks = node.subtasks || {};
        node.subtasks[childId] = flat.find(task => task.id === childId);
        exclude.push(childId);
      });
    }
    delete node.children;
  });

  const tree = flat.filter(task => !exclude.includes(task.id)).reduce((acc, task) => {
    acc[task.id] = task;
    return acc;
  }, {});

  if (config.output === 'list') {
    console.log(printListTree(tree));
  } else if (config.output === 'slack-attachments') {
    console.log(printSlackAttachmentsList(tree));
  }
};

/**
 * Print functions, print<Namespace><Func>
 */

const printListTask = (task, level = 0) => {
  const indent = ' '.repeat(4 * level)
  return (`
${indent}-   ${task.id} https://sequencing.atlassian.net/browse/${task.id} (${task.assignee})
${indent}    ${task.summary}
`);
}

const printListTree = (tree, level = 0) => {
  let output = '';
  Object.keys(tree).forEach(id => {
    output += printListTask(tree[id], level);
    if (tree[id].subtasks) {
      output += printListTree(tree[id].subtasks, level + 1);
    }
  });
  return output;
};

const getSlackAtMentionString = jiraName => {
  return ({
    'Arūnas Paulauskas': 'UJL7US770',
    'Deividas Guiskis': 'UQ5H8M8BB',
    'Juozas Mudrikas': 'UAPD67Y3S',
    'Karolis Grinkus': 'UAW8HK84D',
    'Linas Balke': 'UAVTZNF29',
    'Rimantas Matusevicius': 'UAVS6RYMA',
    'Rytis Eidukaitis': 'UMA081LC9',
  })[jiraName] || jiraName;
};

const printSlackAttachmentsTask = (task, parentId) => {
  return (`{
  "mrkdwn_in": ["text"],
  "title": "${task.id}${!!parentId ? ` (child of ${parentId})` : ``}",
  "title_link": "https://sequencing.atlassian.net/browse/${task.id}",
  "text": "${task.summary} (<@${getSlackAtMentionString(task.assignee)}>)"
},
`);
};

const getRandomArrayMember = arr => arr[arr.length * Math.random() | 0];

const getGreeting = () => getRandomArrayMember([
  `Sveiki vyrukai!`,
  `Vyručiai!`,
  `Sveiki lūzeriai!`,
  `Sveikučiukai!`,
  `Labas niekšeliai!`,
  `Kylam!`,
  `Nagi nagi nagi!`,
  `Ką aš žinau...`,
  `Tebūnie pasveikintas!`,
  `Tai prisidirbot?`,
]);

const getCallToAction = () => {
  const productionCTAs= [
    `Eikit testuot kartu su <@UMA081LC9>.`,
    `Eikit testuot, <@UMA081LC9> irgi.`,
    `Visi testuojam dabar, ir dev'ai, ir <@UMA081LC9>.`,
  ];
  const stagingCTAs = [
    `Eikit testuot.`,
    `Pats laikas patestuot.`,
  ];
  const stagingOutros = [
    `Po to paping'inkit Rytį komentare ant task'o, jei viskas OK, kad ir jis patestuotų.`,
    `Jei viskas OK, paping'inkit Rytį komentare ant task'o, kad ir jis patestuotų.`,
  ];
  if (ENV === 'production') {
    return getRandomArrayMember(productionCTAs);
  } else {
    return `${getRandomArrayMember(stagingCTAs)} ${getRandomArrayMember(stagingOutros)}`;
  }
};

const getSuccess = () => {
  const productionSuccesses = [
    `*Produkcija* sėkmingai pabuild'inta.`,
    `*Produkcija* pabuild'inta.`,
    `*Produkcija* suvažiavo.`,
    `*Produkcijos* build'as done.`,
    `*Prod'as* sėkmingai suvažiavo.`,
    `*Prod'as* suvažiavo.`,
    `*Prod'o* build'as done.`,
  ];
  const stagingSuccesses = [
    `*Staging'o* build'as done.`,
    `*Staging'o* build'as pavyko.`,
    `*Staging'o* build'as įvyko.`,
    `*Staging'as padeploy'intas.`,
    `*Staging'as* suvažiavo.`,
    `*Staging'as* sėkmingai suvažiavo.`,
    `*Staging'as* sėkmingai done.`,
  ];
  if (ENV === 'production') {
    return getRandomArrayMember(productionSuccesses);
  } else {
    return getRandomArrayMember(stagingSuccesses);
  }
};

const printSlackAttachmentsList = (tree) => {
  let output = `
{
  "username": "Brendona Kolbytė",
  "text": "${getGreeting()} ${getSuccess()} ${getCallToAction()}",
  "icon_emoji": ":sequencing:",
  "link_names": true,
  "unfurl_links": false,
  "unfurl_media": false,
  "mrkdwn": true,
      "attachments": [
`;
  output += printSlackAttachmentsTree(tree);
  output = output.slice(0, -2); // Remove last comma
output += `
    ]
}`;
  return JSON.stringify(JSON.parse(output), undefined, 2);
}

const printSlackAttachmentsTree = (tree, parentId) => {
  let output = ``;
  Object.keys(tree).forEach(id => {
    output += printSlackAttachmentsTask(tree[id], parentId);
    if (tree[id].subtasks) {
      output += printSlackAttachmentsTree(tree[id].subtasks, id);
    }
  });
  return output;
};

process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', function(chunk) {
  input += chunk;
});
process.stdin.on('end', init);

