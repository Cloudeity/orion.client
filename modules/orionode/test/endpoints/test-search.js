/*******************************************************************************
 * Copyright (c) 2017 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*eslint-env mocha */
var express = require("express"),
	assert = require('assert'),
	supertest = require("supertest"),
	path = require("path"),
	testData = require("../support/test_data"),
	store = require('../../lib/metastore/fs/store'),
	testHelper = require('../support/testHelper'),
	workspace = require('../../lib/workspace'),
	file = require('../../lib/file'),
	search = require("../../lib/search");

var CONTEXT_PATH = '',
	PREFIX_WORKSPACE = CONTEXT_PATH + '/workspace', 
	PREFIX_FILE = CONTEXT_PATH + '/file',
	PREFIX = CONTEXT_PATH + '/filesearch',
	WORKSPACE_ID = 'anonymous-OrionContent',
	TEST_WORKSPACE_NAME = '.test_workspace',
	WORKSPACE = path.join(__dirname, TEST_WORKSPACE_NAME),
	MEATASTORE =  path.join(__dirname, '.test_metadata');

var options = {
		workspaceRoot: CONTEXT_PATH + '/workspace', 
		fileRoot: CONTEXT_PATH + '/file', 
		gitRoot: CONTEXT_PATH + '/gitapi',
		configParams: {
			"orion.single.user": true,
			"orion.single.user.metaLocation": MEATASTORE
		},
		workspaceDir: WORKSPACE
	};

var app = express();
	app.locals.metastore = store(options);
	app.locals.metastore.setup(app);
	app.use(PREFIX, search(options));
	app.use(PREFIX_WORKSPACE, workspace(options));
	app.use(PREFIX_FILE, file(options));

testHelper.handleErrors(app);

var request = supertest.bind(null, app);

describe("Search endpoint", function() {
	beforeEach("Create the default workspace and create metadata", function(done) {
		testData.setUp(WORKSPACE, function() {
			testData.setUpWorkspace(WORKSPACE, MEATASTORE, done);
		}, false);
	});
	afterEach("Remove .test_workspace", function(done) {
		testData.tearDown(testHelper.WORKSPACE, function(){
			testData.tearDown(path.join(MEATASTORE, '.orion'), function() {
				testData.tearDown(MEATASTORE, done)
			});
		});
	});
	//search query shape
	//filesearch?
		//sort=Path%20asc
		//&rows=10000
		//&start=0
		//&q=<name>+Location:<where to search>+Exclude:<comma list of names to exclude>
	/**
	 * From: org.eclipse.orion.server.tests.search.SearchTest.java
	 */
	it("testSimpleSearch", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
			.end(function(err, res) {
				testHelper.throwIfError(err);
				var sLoc = res.body.Location;
				if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
					sLoc = res.body.Projects[0].Location;
				}
				request()
					.get(PREFIX)
					.query('Path%20asc&rows=5&start=0&q=hello+Location:'+sLoc)
					.expect(200)
					.end(function(err, res) {
						testHelper.throwIfError(err);
						assert(res.body.response, "There must be a search response");
						assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
						assert(res.body.response.docs.length > 0, "There should have been at least one hit");
						done();
					});
			});
	});
	it("testUnknownTerm", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
			.end(function(err, res) {
				testHelper.throwIfError(err);
				var sLoc = res.body.Location;
				if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
					sLoc = res.body.Projects[0].Location;
				}
				request()
					.get(PREFIX)
					.query('Path%20asc&rows=5&start=0&q=hello+Something:foo+Location:'+sLoc)
					.expect(200)
					.end(function(err, res) {
						testHelper.throwIfError(err);
						assert(res.body.response, "There must be a search response");
						assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
						assert(res.body.response.docs.length > 0, "There should have been at least one hit");
						done();
					});
			});
	});
	it("testUnknownTermMixedTail", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
			.end(function(err, res) {
				testHelper.throwIfError(err);
				var sLoc = res.body.Location;
				if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
					sLoc = res.body.Projects[0].Location;
				}
				request()
					.get(PREFIX)
					.query('Path%20asc&rows=5&start=0&q=hello+Location:'+sLoc+'+Something:foo')
					.expect(200)
					.end(function(err, res) {
						testHelper.throwIfError(err);
						assert(res.body.response, "There must be a search response");
						assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
						assert(res.body.response.docs.length > 0, "There should have been at least one hit");
						done();
					});
			});
	});
	it("testUnknownTermMixedMid", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
			.end(function(err, res) {
				testHelper.throwIfError(err);
				request()
					.get(PREFIX)
					.query('Path%20asc&rows=5&start=0&q=project+Location:'+res.body.Location+'+Something:foo+Exclude:one,two,three')
					.expect(200)
					.end(done);
			});
	});
	it("testPartialWord", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=*hel+Location:'+sLoc)
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length > 0, "There should have been at least one hit");
					done();
				});
		});
	});
	it("testPhraseSearch", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=hello%20world+Location:'+sLoc)
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length > 0, "There should have been at least one hit");
					done();
				});
		});
	});
	it("testPhraseDifferentCase", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=helLo%20worLd+Location:'+sLoc)
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length > 0, "There should have been at least one hit");
					done();
				});
		});
	});
	it("testPhraseDifferentCaseCaseSensitive", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=helLo%20worLd+Location:'+sLoc+'+CaseSensitive:true')
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length === 0, "There should have been no hits");
					done();
				});
		});
	});
	it("testSingleWord", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=hello+Location:'+sLoc+'+WholeWord:true')
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length > 0, "There should have been at least one hit");
					done();
				});
		});
	});
	it("testSingleWordNoMatch", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=hel+Location:'+sLoc+'+WholeWord:true')
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length === 0, "There should have been no hits");
					done();
				});
		});
	});
	it("testSearchExcluded", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=hel*+Location:'+sLoc+'+Exclude:fizz.txt')
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length === 0, "There should have been no hits");
					done();
				});
		});
	});
	it("testFilenameSearch", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=hel*+Location:'+sLoc+'+Name:fizz.txt')
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length > 0, "There should have been at least one hit");
					done();
				});
		});
	});
	it("testFilenameSearchNoMatch", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=hel*+Location:'+sLoc+'+Name:buzz.txt')
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length === 0, "There should have been no hits");
					done();
				});
		});
	});
	it("testRegExSearch", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=hel*+Location:'+sLoc+'+RegEx:true')
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length > 0, "There should have been at least one hit");
					done();
				});
		});
	});
	it("testCaseSensitive", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=hello+Location:'+sLoc+'+CaseSensitive:true')
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length > 0, "There should have been at least one hit");
					done();
				});
		});
	});
	it("testCaseSensitiveNoMatch", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=Hello+Location:'+sLoc+'+CaseSensitive:true')
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length === 0, "There should have been no hits");
					done();
				});
		});
	});
	it("testHTMLTag", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=%3Chtml%3E+Location:'+sLoc)
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length === 1, "There should have been one hit");
					done();
				});
		});
	});
	it("testWordConcatenation", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=myFunc(one+Location:'+sLoc)
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert(res.body.response.docs.length === 1, "There should have been one hit");
					done();
				});
		});
	});
	it("testSearchNonAlphaNumeric", function(done) {
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('Path%20asc&rows=5&start=0&q=amber%26sand+Location:'+sLoc)
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert.equal(res.body.response.docs.length, 1, "There should have been one hit");
					done();
				});
		});
	});
	it("Bug522584", function(done){
		testHelper.withWorkspace(request, PREFIX_WORKSPACE, WORKSPACE_ID)
		.end(function(err, res) {
			testHelper.throwIfError(err);
			var sLoc = res.body.Location;
			if(Array.isArray(res.body.Projects) && res.body.Projects[0]) {
				sLoc = res.body.Projects[0].Location;
			}
			request()
				.get(PREFIX)
				.query('sort=NameLower%20asc&rows=100&start=0&q=NameLower:fizz.txt*+Location:/file*')
				.expect(200)
				.end(function(err, res) {
					testHelper.throwIfError(err);
					assert(res.body.response, "There must be a search response");
					assert(Array.isArray(res.body.response.docs), "There must be a search response docs array");
					assert.equal(res.body.response.docs.length, 1, "There should have been one hit");
					done();
				});
		});
	});
	it("testSearchInProjectWithURLName");
	it("testPathWithDBCS");
	it("testFileWithDBCS");
	it("testSearchDBCS");
});
	