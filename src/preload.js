const electron = require('electron')
const remote = electron.remote;

const child_process = require('child_process');
const util = require('util');
const path = require('path');
const execFile = util.promisify(child_process.execFile);
const moment = require('moment');

const mainPath = path.resolve(__dirname, 'main.js');
const mainProcess = remote.require(mainPath);

function bup_sort_entries(entries) {
  entries.sort((a, b) => {
    if (a.folder && !b.folder) {
      return -1
    }
    if (!a.folder && b.folder) {
      return 1
    }

    if (a.title.toUpperCase() < b.title.toUpperCase()) {
      return -1;
    }
    if (a.title.toUpperCase() > b.title.toUpperCase()) {
      return 1;
    }

    return 0;
  });
  return entries;
}

function bup_ls_split(line, node, opts) {
  if (opts === null || opts === undefined) {
    opts = {};
  }

  const matches = line.match(/(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/);
  let target;
  let title = matches[6];
  let key = matches[6];
  let size = parseInt(matches[3]);
  let unselectable = false;
  let snapshot = false;
  const perms = matches[1];
  const symlink = perms.startsWith('l');
  const [user, group] = matches[2].split('/');
  if (symlink) {
    [title, target] = title.split(' -> ');
    key = title;
  }
  let folder = title.endsWith('/');
  if (folder) {
    title = title.slice(0, -1);
  }
  if (symlink) {
    if (node && node.data && node.data.branch) {
      snapshot = true;
      folder = true;
      title = title.slice(0, -1);
      if (title !== 'latest') {
        let edate = moment(title, "YYYY-MM-DD-HHmmss");
        key = title + "/";
        title = edate.format('MMM D, YYYY h:mm a');
      } else {
        key = title + "/";
      }
    } else {
      title = title.slice(0, -1);
      key = title;
    }
  }
  if (opts.branch || folder || (node && node.data && node.data.branch)) {
    size = undefined;
  }
  if (opts.branch || (node && node.data && node.data.branch)) {
    unselectable = true;
  }

  return {
    title: title,
    key: key,
    folder: folder,
    symlink: symlink,
    branch: opts.branch === true,
    size: size,
    date: new Date(matches[4] + " " + matches[5]),
    perms: perms,
    target: target,
    user: user,
    group: group,
    lazy: folder,
    unselectable: unselectable,
    snapshot: snapshot
  }
}

function node_key_path(node, path) {
  console.log(node);

  if (node.parent === null) {
    return path;
  } else {
    return node_key_path(node.parent, node.key + path);
  }
}

function bup_selectRestoreDirectory(callback) {
  mainProcess.selectRestoreDirectory(callback);
}

function quitApp(callback) {
  mainProcess.quitApp();
}

// https://stackoverflow.com/questions/3115150/how-to-escape-regular-expression-special-characters-using-javascript/9310752
function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&');
}

async function entriesFromCommitAndPath(node) {
  const commit = node.data.commit;
  const basepath = node.data.path;

  const cmd_output = await execFile("/usr/local/bin/git", ['-C', '/Users/chadj/.bup', 'diff-tree', '--no-commit-id', '--name-only', '-r', commit]);
  let lines = cmd_output.stdout.split('\n');
  lines = lines.filter(_ => _ !== '').map(_ => _.split(/\.bup[m\/]/, 2)[0]).filter(_ => _ != '' && !_.endsWith('/'));

  const pathContentsRegex = new RegExp('^'+escapeRegExp(basepath)+'([^/]+)(/*)');
  const pathContents = new Set();
  for(let line of lines) {
    const match = line.match(pathContentsRegex);
    if(match) {
      let path = match[1];
      if(match[2]) {
        path = path + match[2];
      }
      pathContents.add(path);
    }
  };

  let entries = [];
  for(let path of pathContents) {
    let title = path;
    let key = path;
    let folder = title.endsWith('/');
    let fullPath = basepath + path

    if (folder) {
      title = title.slice(0, -1);
    }

    entries.push({
      title: title,
      key: key,
      folder: folder,
      symlink: false,
      branch: false,
      lazy: folder,
      unselectable: false,
      snapshot: false,
      changes: true,
      path: fullPath,
      commit: commit
    });
  }

  entries = bup_sort_entries(entries);

  return entries
}

async function bup_source() {
  const cmd_output = await execFile("/usr/local/bin/bup", ['ls', '-Al', '--file-type']);
  let lines = cmd_output.stdout.split('\n');
  lines = lines.filter(_ => _ !== '');

  let entries = lines.map(_ => bup_ls_split(_, undefined, {
    branch: true
  }));
  entries = entries.filter(_ => !_.title.startsWith('.'));

  return entries;
}

async function bup_lazyLoad(event, data) {
  let entries;

  if (data.node && data.node.data && data.node.data.changes) {
    entries = await entriesFromCommitAndPath(data.node);
  } else {
    let path = node_key_path(data.node, '');

    const cmd_output = await execFile("/usr/local/bin/bup", ['ls', '-Al', '--file-type', path]);
    let lines = cmd_output.stdout.split('\n');
    lines = lines.filter(_ => _ !== '');

    entries = lines.map(_ => bup_ls_split(_, data.node));

    if (data.node && data.node.data && data.node.data.branch) {
      entries.reverse();
    } else {
      entries = bup_sort_entries(entries);
    }

    if(data.node && data.node.data && data.node.data.snapshot) {
      var target = data.node.data.target;
      const matches = target.match(/\/([^\/]+)\/([^\/]+)$/);
      const commit = matches[1] + matches[2];
      entries.unshift({
        title: "&#x3C;changes&#x3E;",
        key: '',
        folder: true,
        symlink: false,
        branch: false,
        lazy: true,
        unselectable: true,
        snapshot: false,
        changes: true,
        path: '',
        commit: commit
      });
    }

    if (entries.length > 50) {
      entries = entries.slice(0, 50);
      entries.push({
        title: "More...",
        statusNodeType: "paging",
        icon: false,
        continueNode: data.node
      });
    }
  }

  return entries
}

async function bup_clickPaging(event, data) {
  const current_node = data.node.data.continueNode;
  let path = node_key_path(current_node, '');

  const cmd_output = await execFile("/usr/local/bin/bup", ['ls', '-AlF', path]);
  let lines = cmd_output.stdout.split('\n');
  lines = lines.filter(_ => _ !== '');

  let entries = lines.map(_ => bup_ls_split(_, current_node));

  if (current_node && current_node.data && current_node.data.branch) {
    entries.reverse();
  } else {
    entries = bup_sort_entries(entries);
  }

  entries = entries.slice(50);

  return entries
}

async function bup_restore(restorePoint, toRestorePaths) {
  const cmd_output = await execFile("/usr/local/bin/bup", ['restore', '-C', restorePoint].concat(toRestorePaths));
}

function bup_source_wrapper() {
  var dfd = new $.Deferred();
  bup_source().then(dfd.resolve).catch(dfd.reject);
  return dfd;
}

function bup_lazyLoad_wrapper(event, data) {
  var dfd = new $.Deferred();
  bup_lazyLoad(event, data).then(dfd.resolve).catch(dfd.reject);
  data.result = dfd;
}

function bup_clickPaging_wrapper(event, data) {
  var dfd = new $.Deferred();
  bup_clickPaging(event, data).then(dfd.resolve).catch(dfd.reject);
  data.node.replaceWith(dfd);
}

process.once('loaded', () => {
  global.bup_source = bup_source_wrapper;
  global.bup_lazyLoad = bup_lazyLoad_wrapper;
  global.bup_clickPaging = bup_clickPaging_wrapper;
  global.bup_selectRestoreDirectory = bup_selectRestoreDirectory;
  global.bup_restore = bup_restore;
  global.node_key_path = node_key_path;
  global.quitApp = quitApp;
  global.moment = moment;
})
