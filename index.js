const fs = require('fs');
const https = require("https");
const allSettled = require('promise.allsettled');

const config = require('./config.json');

const authHeaders = {
  'Authorization': `Basic ${Buffer.from(`${config.authUser}:${config.authPass}`).toString('base64')}`,
};

const tasks = {};

let input = '';
let issues = [];

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

  console.log(printTree(tree));
};

const printTask = (task, level = 0) => {
  const indent = ' '.repeat(4 * level)
  return (`
${indent}-   ${task.id} https://sequencing.atlassian.net/browse/${task.id} (${task.assignee})
${indent}    ${task.summary}
`);
}

const printTree = (tree, level = 0) => {
  let output = '';
  Object.keys(tree).forEach(id => {
    output += printTask(tree[id], level);
    if (tree[id].subtasks) {
      output += printTree(tree[id].subtasks, level + 1);
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

