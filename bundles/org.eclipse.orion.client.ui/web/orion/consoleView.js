/*******************************************************************************
 * Copyright (c) 2013, 2016 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License v1.0
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).
 *
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*eslint-env browser, amd*/
define([
	"socket.io/socket.io",
	"xterm/xterm",
	"orion/PageUtil",
	'orion/generalPreferences'
], function(io, Terminal, PageUtil, mGeneralPrefs) {

	var colorScheme = "Dark";

	function getCWD() {
		var result = PageUtil.matchResourceParameters(window.location.href).resource;
		return result.length > 0 ? result : null;
	}
	
	function qualify(url) {
		return new URL(url, self.location.href).href;
	}
	function unqualify(url) {
		url = qualify(url);
		try {
			if (typeof window === "undefined") {
				return url.substring(self.location.href.indexOf(self.location.host) + self.location.host.length);
			}
			if (window.location.host === parent.location.host && window.location.protocol === parent.location.protocol) {
				return url.substring(parent.location.href.indexOf(parent.location.host) + parent.location.host.length);
			}
		} catch (e) {}
		return url;
	}

	/**
	 * Constructs a new ConsoleView object.
	 *
	 * @class
	 * @name orion.ConsoleView
	 */
	function ConsoleView(options) {
		this._parent = options.parent;
		this._metadata = options.metadata;
		this.menuBar = options.menuBar;
		this.fileClient = options.fileService;
		this.progress = options.progressService;
		this.serviceRegistry = options.serviceRegistry;
		this.commandRegistry = options.commandRegistry;
		this.contentTypeRegistry = options.contentTypeRegistry;
		this.editorInputManager = options.inputManager;
		this.preferences = options.preferences;
		this.generalPrefs = new mGeneralPrefs.GeneralPreferences(this.preferences);
		this.rows = 24;
		this.cols = 80;
	}
	ConsoleView.prototype = /** @lends orion.ConsoleView.prototype */ {
		resize: function() {
			var socket = this.socket;
			var term = this.term;
			if (socket === null || term === null) return;
			var termContainer = this._parent,
				newWidth = termContainer.clientWidth,
				newHeight = termContainer.clientHeight;
			if (this.charWidth === undefined) {
				var span = document.createElement("span");
				span.textContent = "X";
				termContainer.appendChild(span);
				var rect = span.getBoundingClientRect();
				this.charWidth = rect.right - rect.left;
				this.charHeight = rect.bottom - rect.top + 2;
				termContainer.removeChild(span);
			}
			var newRows = (newHeight - 10) / (this.charHeight || 12);
			var newCols = Math.max(80, (newWidth - 10) / (this.charWidth || 12));
			if (newRows === this.rows && newCols !== this.cols) return;
			this.rows = newRows;
			this.cols = newCols;
			term.resize(Math.floor(newCols), Math.floor(newRows));
			socket.emit('resize', Math.floor(newCols), Math.floor(newRows));
		},
		changeScheme: function(schemeName) {
			var t;
			if (this.term !== null) {
				t = document.querySelector('.terminal');
				t.setAttribute('scheme', schemeName);
			}
			if (this.serviceRegistry) {
				this.serviceRegistry.getService("orion.core.preference").put("/orion/console", {"colorScheme": schemeName});
			}
		},
		create: function() {
			var node = this._parent;
	
			var socketioPath = unqualify(require.toUrl('socket.io'));
			var socket = this.socket = io.connect('/tty', { path: socketioPath });
			socket.on('connect', function() {
				socket.emit('start', getCWD());
			});
			socket.on('fail', function(error) {
				console.log(error);
			});
			socket.on('error', function(error) {
				console.log(error);
			});
		
			socket.on('ready', function() {
				var term = this.term = new Terminal({
					cols: this.cols,
					rows: this.rows,
					cursorBlink: true
				});
				
				term.on('data', function(data) {
					socket.emit('data', data);
				});
	
				term.on('title', function(title) {
					document.title = title;
				});
				var termContainer = node;
				term.open(termContainer, true);
				
				this.resize();
				var _this = this;
	
				var timeout;
				window.addEventListener("resize", this.resizeListener = function() {
					if (timeout) clearTimeout(timeout);
					timeout = setTimeout(function() {
						_this.resize();
						timeout = null;
					}, 500);
				});
				socket.on('data', function(data) {
					term.write(data);
				});
				socket.on('disconnect', function() {
					term.destroy();
				});
				
				this.changeScheme(colorScheme);
			}.bind(this));
		},
		destroy: function() {
			if (!this.socket) return;
			if (this.resizeListener) {
				window.removeEventListener("resize", this.resizeListener);
				this.resizeListener = null;
			}
			this.socket.close();
			this.socket = null;
			this.term = null;
			this._node = null;
		}
	};
	return {
		ConsoleView: ConsoleView
	};
});