/*******************************************************************************
 * Copyright (c) 2012, 2017 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License v1.0
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).
 *
 * Contributors:
 *	 IBM Corporation - initial API and implementation
 *******************************************************************************/
/*eslint-env node */
var api = require('../api'), writeError = api.writeError, writeResponse = api.writeResponse;
var git = require('nodegit');
var clone = require('./clone');
var express = require('express');
var bodyParser = require('body-parser');

function router(options) {
	var fileRoot = options.fileRoot;
	var gitRoot = options.gitRoot;
	if (!fileRoot) { throw new Error('options.fileRoot is required'); }
	if (!gitRoot) { throw new Error('options.gitRoot is required'); }
	
	var contextPath = options && options.configParams["orion.context.path"] || "";
	fileRoot = fileRoot.substring(contextPath.length);

	return express.Router()
	.use(bodyParser.json())
	.use(options.checkUserAccess)
	.get('*', getStatus);
	
	function getStatus(req, res) {
		return clone.getRepo(req)
		.then(function(repo) {
			var fileDir = clone.getfileDir(repo,req);
			return repo.getStatusExt({
				flags: 
					git.Status.OPT.INCLUDE_UNTRACKED | 
					git.Status.OPT.RECURSE_UNTRACKED_DIRS
			}).then(function(statuses) {
	
				var added = [],
					changed = [],
					conflicting = [],
					missing = [],
					modified = [],
					removed = [], 
					untracked = [];
		
				function returnContent(file, diffType) {
					diffType = diffType || "Default";
					var orionFilePath = api.join(fileDir, file.path());
					return {
						"Git": {
							"CommitLocation": gitRoot + "/commit/HEAD" + orionFilePath,
							"DiffLocation": gitRoot + "/diff/" + diffType + orionFilePath,
							"IndexLocation": gitRoot + "/index" + orionFilePath
						},
						"Location": orionFilePath,
						"Name": file.path(),
						"Path": file.path()
					};
				}
			
				statuses.forEach(function(file) {
					var bit = file.statusBit();
					
					if (bit & git.Status.STATUS.CONFLICTED) {
						conflicting.push(returnContent(file));
					}
					
					if (bit & git.Status.STATUS.WT_MODIFIED) {
						modified.push(returnContent(file));
					}
					
					if (bit & git.Status.STATUS.WT_DELETED) {
						missing.push(returnContent(file));
					}
					
					if (bit & git.Status.STATUS.WT_NEW) {
						untracked.push(returnContent(file));
					}
					
					if (bit & git.Status.STATUS.INDEX_NEW) {
						added.push(returnContent(file, "Cached"));
					}
					
					if (bit & git.Status.STATUS.INDEX_MODIFIED) {
						changed.push(returnContent(file, "Cached"));
					}
					
					if (bit & git.Status.STATUS.INDEX_DELETED) {
						removed.push(returnContent(file, "Cached"));
					}
					
				});
			
				var repoState = "SAFE";
				
				if (repo.isRebasing()) {
					repoState = "REBASING";
				} 
				else if (repo.isReverting()) {
					repoState = "REVERTING";
				}
				else if (repo.isMerging()) {
					repoState = "MERGING";
				}
				else if (repo.isCherrypicking()){
					repoState = "CHERRY_PICKING";
				}
				
				writeResponse(200, res, null, {
					"Added": added,
					"Changed": changed,
					"CloneLocation": gitRoot + "/clone" + fileDir,
					"CommitLocation": gitRoot + "/commit/HEAD" + fileDir,
					"Conflicting": conflicting,
					"IndexLocation": gitRoot + "/index" + fileDir,
					"Location": gitRoot + "/status" + fileRoot + fileDir,
					"Missing": missing,
					"Modified": modified,
					"Removed": removed,
					"RepositoryState": repoState,
					"Type": "Status",
					"Untracked": untracked   
				}, true);
			});
		})
		.catch(function(err) {
			writeError(400, res, err);
		});
	}
}

module.exports = {
	router: router
};
