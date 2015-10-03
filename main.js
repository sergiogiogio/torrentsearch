
var torrent_search = require("./torrent_search.js");
var terminalWidgets = require("terminal-widgets");
var chalk = require('chalk');
var fileSizeParser = require('filesize-parser');
var dateParser = require("date.js");

// "limetorrents" "http://limetorrents.cc"
// "extratorrent" "http://extratorrent.cc"
// "thepiratebay" "https://thepiratebay.la"
// "yts" "https://yts.to"
// "btdigg" "https://btdigg.org"
// "seedpeer" "http://seedpeer.eu"
// "1337x" "https://1337x.to"
// "nyaa" "http://www.nyaa.se"
// "strike" "https://getstrike.net"
// "kickass" "https://www.kat.cr"
// "tokyotosho" "https://www.tokyotosho.info"
// :17,27s/\/\/ "\([^"]\+\)" "\([^"]\+\)"/function() { var obj = require("torrentflix\/lib\/\1.js"); return { name: "\1", search: function(query) { return obj.search(query, null, null, "\2"); } }  }(),/	

var scrapers = [
	function() { var obj = require("torrentflix/lib/limetorrents.js"); return { name: "limetorrents", search: function(query) { return obj.search(query, null, 1, "http://limetorrents.cc"); } }  }(),
	function() { var obj = require("torrentflix/lib/extratorrent.js"); return { name: "extratorrent", search: function(query) { return obj.search(query, null, null, "http://extratorrent.cc"); } }  }(),
	function() { var obj = require("torrentflix/lib/thepiratebay.js"); return { name: "thepiratebay", search: function(query) { return obj.search(query, null, null, "https://thepiratebay.la"); } }  }(),
	function() { var obj = require("torrentflix/lib/yts.js"); return { name: "yts", search: function(query) { return obj.search(query, null, null, "https://yts.to"); } }  }(),
	function() { var obj = require("torrentflix/lib/btdigg.js"); return { name: "btdigg", search: function(query) { return obj.search(query, "https://btdigg.org"); } }  }(),
	function() { var obj = require("torrentflix/lib/seedpeer.js"); return { name: "seedpeer", search: function(query) { return obj.search(query, "http://seedpeer.eu"); } }  }(),
	function() { var obj = require("torrentflix/lib/1337x.js"); return { name: "1337x", search: function(query) { return obj.search(query, "https://1337x.to"); } }  }(),
	function() { var obj = require("torrentflix/lib/nyaa.js"); return { name: "nyaa", search: function(query) { return obj.search(query, null, null, "http://www.nyaa.se"); } }  }(),
	function() { var obj = require("torrentflix/lib/strike.js"); return { name: "strike", search: function(query) { return obj.search(query, null, null, "https://getstrike.net"); } }  }(),
	function() { var obj = require("torrentflix/lib/kickass.js"); return { name: "kickass", search: function(query) { return obj.search(query, null, null, "https://www.kat.cr"); } }  }(),
	function() { var obj = require("torrentflix/lib/tokyotosho.js"); return { name: "tokyotosho", search: function(query) { return obj.search(query, null, null, "https://www.tokyotosho.info"); } }  }(),
	function() { var obj = require("./cpasbien.js"); return { name: "cpasbien", search: function(query) { return obj.search(query, "http://www.cpasbien.pw"); } }  }()
];

//scrapers = [ scrapers[0] ];
//scrapers = [ ];

var results = [], allResults = [];

// ============
// UI
// ============
var widgetContext = new terminalWidgets.WidgetContext();
var uiWidth = function() {
	return process.stdout.columns;
};

var resultsMenuItemStyle = function(selected, focused) {
	if(selected && focused) return chalk.black.bgWhite;
	else if(selected && !focused) return chalk.gray.bgWhite;
	else return function(str){ return str; };
}

var scraperStyle = function(status) {
	switch(status) {
		case "ok": return chalk.green;
		case "error": return chalk.red;
	}
	return function(str){ return str; };
}

var nostyle = function(str) { return str; };

var printable = function(str) {
	return (str || "").toString().trim().replace(/[^\x20-\x7E]/g, ".");
}

var scrapersStatusLabel = new terminalWidgets.Label({
		width: function() { return Math.floor(uiWidth()*80/100);  },
		height: function() { return scrapers.length; },
                item: function(item, width) { 

			return scraperStyle(scrapers[item].status) (terminalWidgets.padRight(scrapers[item].name + ": " + scrapers[item].status + ", " + scrapers[item].status_message, width)); 
		}
        });
var resultsMenuScrollWidth = 0, newResultsMenuScrollWidth = 0;
var resultsMenuRedrawTimeout = null;
var resultsMenu = new terminalWidgets.VMenu({
		width: function() { return uiWidth() - resultsMenuVScrollBar.callback.width();  },
		height: function() { return 10 - resultsMenuHScrollBar.callback.height(); },	
                itemsCount: function() { return results.length; },
                scrollWidth: function() { return resultsMenuScrollWidth; },
                item: function(item, current, width, hScroll) {
			var torrent = results[item];
			var columnWidths = [ Math.floor(width*5/100), 1, 0, 1, Math.floor(width*5/100), 1, Math.floor(width*15/100), 1, Math.floor(width*15/100), 1, Math.floor(width*5/100), 1, Math.floor(width*5/100) ];
			columnWidths[2] = width - columnWidths.reduce(function(a,b) { return a + b; });
			newResultsMenuScrollWidth = Math.max(newResultsMenuScrollWidth, printable(torrent.title).length + width - columnWidths[2]);
			if(resultsMenuScrollWidth != newResultsMenuScrollWidth && !resultsMenuRedrawTimeout) {
				resultsMenuRedrawTimeout = setTimeout(function() {
					resultsMenuScrollWidth = newResultsMenuScrollWidth;
					widgetContext.draw();
					resultsMenuRedrawTimeout = null;
				}, 0);
			} // async redraw (we can't redraw here)

			var line = terminalWidgets.padRightStop(torrent.scraper.name, columnWidths[0], hScroll) + "|"
				+ terminalWidgets.padRightStop(printable(torrent.title), columnWidths[2], hScroll) + "|"
				+ terminalWidgets.padRightStop(printable(torrent.torrent_verified), columnWidths[4], hScroll) + "|"
				+ terminalWidgets.padRightStop(printable(torrent.date_added), columnWidths[6], hScroll) + "|"
				+ terminalWidgets.padRightStop(printable(torrent.size), columnWidths[8], hScroll) + "|"
				+ terminalWidgets.padRightStop(printable(torrent.seeds), columnWidths[10], hScroll) + "|" 
				+ terminalWidgets.padRightStop(printable(torrent.leechs), columnWidths[12], hScroll);
			return  resultsMenuItemStyle(current, widgetContext.focusedWidget === resultsMenu) (line);
		},
                itemSelected: function(item) {
			if(results[item])
				processTorrent(results[item], function(success, message) {
					widgetContext.setWidget(layout, false); // keep output of the command
					if(success) {
						
					} else {
						logMessage("ERROR", "processTorrent", String(message), encodeURI(results[item].torrent_link || results[item].torrent_site));
					}
					widgetContext.draw();
				});
		},
		handleKeyEvent: function(key) {
			if(key >= "\x20") { // printable + backspace
				widgetContext.setFocus( searchFieldInput );
				searchFieldInput.handleKeyEvent(key);
				return true;
			}
			return false;
		}
        });

var resultsMenuVScrollBar = new terminalWidgets.VScrollBar({
        height: function() { return resultsMenu.callback.height(); },
        width: function() { return (resultsMenu.callback.itemsCount() > resultsMenu.callback.height()) ? 1 : 0; },
        scrollBarInfo: function(size) {
                return terminalWidgets.scrollBarInfo(resultsMenu.topItem, resultsMenu.callback.height(), resultsMenu.callback.itemsCount(), size);
        },
        item: function(bar, width) {
                return (bar? chalk.bgBlue : nostyle)(terminalWidgets.padRight("", width));
        }
});


var resultsMenuHScrollBar = new terminalWidgets.HScrollBar({
        height: function() { return (resultsMenu.callback.scrollWidth() > 0) ? 1 : 0; },
        width: function() { return resultsMenu.callback.width(); },
        scrollBarInfo: function(size) {
                var ret = terminalWidgets.scrollBarInfo(resultsMenu.hScrollPos, resultsMenu.callback.width(), resultsMenu.callback.scrollWidth(), size);
		//console.log("" + resultsMenu.hScrollPos + "," + resultsMenu.callback.width() + ", " + resultsMenu.callback.scrollWidth() + "," + size + " = " + ret.beg + ", " + ret.end);
		return ret;
        },
        item: function(beg, end, width) {
		//console.log("" + beg + "," + end + ", " + width);
                return terminalWidgets.padRight("", beg) + chalk.bgGreen(terminalWidgets.padRight("", end-beg)) + terminalWidgets.padRight("", width-end);
        }
});

var parseDate = function(str) {
	var ret;
	// cleanup
	str = (str || "").toString().trim()
		.replace(/[^\x20-\x7E]/g, ".");
	ret = new Date(str);	
	//console.log("Date.parse(\"" + str + "\") = " + ret );
	if(!isNaN(ret)) { 
		return ret;
	}

	if(str === "" || str.toLowerCase() === (new Date("")).toString().toLowerCase()) // "Invalid Date" // "Invalid Date"
		return new Date(-8640000000000000); // http://stackoverflow.com/questions/11526504/minimum-and-maximum-date

	str =  str
		.replace(/^a /g, "1 ");
	try {
		ret = dateParser(str);

	} catch(e) {
		logMessage("ERROR", "parseDate", e, str);
		return new Date(-8640000000000000); // http://stackoverflow.com/questions/11526504/minimum-and-maximum-date
	}
	var currentDate = new Date();
	if(ret > currentDate) ret = currentDate - (ret - currentDate); // sometimes the date is an age
	return ret;
}

var parseFileSize = function(str) {
	try {
		// cleanup
		str = (str || "").toString().trim()
			.replace(/[^\x20-\x7E]/g, "")
			.replace(/[^:]*:/,"")
			.replace(/\.([a-zA-Z])/g,"$1")
			.replace(/([kmg])[o]/gi, "$1B")
			.replace(/(byte)($|[^s])/gi, "$1s$2");
		
		return fileSizeParser(str);
	} catch(e) {
		logMessage("ERROR", "parseFileSize", e, str);
		return 0;
	}
}

var parseCount = function(str) {
	str = (str || "").toString().trim()
		.replace(/,/g, "");
	return Number(str);
}


var sortOptionsMenuItemStyle = function(selected, focused) {
	if(selected && focused) return chalk.black.bgWhite;
	else return function(str){ return str; };
}


var sortOptionSelected = -1;
var sortOptions = [
	{ name: "seeds", compareFunction: function(a, b) { return parseCount(b.seeds) - parseCount(a.seeds); } },
	{ name: "age", compareFunction: function(a, b) { return parseDate(b.date_added || "") - parseDate(a.date_added || ""); } },
	{ name: "size", compareFunction: function(a, b) { return parseFileSize(b.size || "") - parseFileSize(a.size || "");} }
];
var refreshResults = function() {
	results = allResults.filter(function(item) {
		return item.title.toLowerCase().indexOf(searchFieldInputLines[0].toLowerCase()) >= 0;
	});
	if(sortOptionSelected >= 0)
		results.sort( sortOptions[sortOptionSelected].compareFunction );
	resultsMenu.shiftVCursor(0); // refresh the view if needed
}
var sortOptionsMenu = new terminalWidgets.VMenu({
		width: function() { return uiWidth() - scrapersStatusLabel.callback.width();  },
		height: function() { return sortOptions.length; },
                itemsCount: function() { return sortOptions.length; },
                scrollWidth: function() { return 0; },
                item: function(item, current, width, hScroll) {
			return sortOptionsMenuItemStyle(current, widgetContext.focusedWidget === sortOptionsMenu)(terminalWidgets.padBoth((item == sortOptionSelected ? "*" : "") + sortOptions[item].name, width));
		},
                itemSelected: function(item) {
			sortOptionSelected = item;
			refreshResults();
			widgetContext.setFocus(resultsMenu);
			widgetContext.draw();
		}
        });


var searchFieldHeaderText = "Search: ";
var searchFieldHeaderLabel = new terminalWidgets.Label({
		width: function() { return searchFieldHeaderText.length; },
		height: function() { return 1; },
                item: function(item, width) {
			return (widgetContext.focusedWidget === searchFieldInput ? chalk.white : chalk.gray)(searchFieldHeaderText);
		}
        });
var searchFieldInputLines = [];
var searchFieldInput = new terminalWidgets.Input(searchFieldInputLines, {
		width: function() { return Math.max(0, uiWidth() - searchFieldHeaderText.length);  },
		height: function() { return 1; },
		maxLines: function() { return 1 },
                item: function(line, cursorColumn, width, hScrollPos) {
			var line = terminalWidgets.padRight(line, width, hScrollPos);
			if(cursorColumn >= 0 && widgetContext.focusedWidget === searchFieldInput)
				line = line.substring(0, cursorColumn-hScrollPos) + chalk.bgBlue(line[cursorColumn-hScrollPos]) + line.substring(cursorColumn-hScrollPos+1);
			return (widgetContext.focusedWidget === searchFieldInput ? chalk.white : chalk.gray)(line);
		},
		textModified : function() {
			refreshResults();
		},
		handleKeyEvent: function(key) {
			if(key < "\x20") { // not printable
				widgetContext.setFocus( resultsMenu );
				resultsMenu.handleKeyEvent(key);
				return true;
			}
			return false;
		}
        });

var debugMessages = Array(3);
var debugMessagesTop = 0, debugMessagesCurrent = 0;
var logMessage = function(level, module, message, data) {
	if(debugMessages[debugMessagesCurrent]) debugMessagesTop = (debugMessagesTop+1) % debugMessages.length;
	debugMessages[debugMessagesCurrent] = { date: new Date(), module: module, message: message, data: data };
	debugMessagesCurrent = (debugMessagesCurrent+1) % debugMessages.length;
}
var debugLabel = new terminalWidgets.Label({
		width: function() { return uiWidth();  },
		height: function() { return (debugMessages[debugMessagesTop] === undefined)? 0 : debugMessages.length; },
                item: function(item, width) {
			var line = debugMessages[(debugMessagesTop+item) % debugMessages.length] ? debugMessages[(debugMessagesTop+item) % debugMessages.length].message.replace(/\n/,"") : "";
			return chalk.yellow(terminalWidgets.padRight(line, width)); 
		}
        });

var layout = new terminalWidgets.VBoxLayout([
	new terminalWidgets.HBoxLayout([ scrapersStatusLabel, sortOptionsMenu ]), 
	new terminalWidgets.HBoxLayout([ resultsMenu, resultsMenuVScrollBar ]), 
	resultsMenuHScrollBar,
	new terminalWidgets.HBoxLayout([ searchFieldHeaderLabel, searchFieldInput ]), 
	debugLabel
]);
	


widgetContext.setWidget(layout);
widgetContext.setFocus(resultsMenu);

var tabOrder = [ resultsMenu, sortOptionsMenu, searchFieldInput ];

// ===================
// Main 
// ===================


var externalCommand = [];
var query = "";
var verbose = false;
var help = false;
for(var i = 2 ; i < process.argv.length ; ++i) {
	if(process.argv[i].startsWith("--exec")) {
		var separator = process.argv[i].substr("--exec".length) || ";";
		while(++i < process.argv.length && process.argv[i] != separator) {
			externalCommand.push(process.argv[i]);
		}
	}
	else if(process.argv[i] == "-v") verbose = true;
	else if(["-h", "-?", "--help"].indexOf(process.argv[i]) >= 0) help = true;
	else query = process.argv[i];
}

if(query === "" || help) {
	console.log("Usage: " + process.argv[0] + " " + process.argv[1] + " <query> [--exec command [initial-arguments]]");
	console.log("    initial-arguments: {} will be replaced by the torrent link");
	process.exit();
}

if(externalCommand.length === 0) externalCommand = [ "echo", "{}" ];

var i;
for (i in scrapers) { (function() {
	var scraper = scrapers[i];
	scraper.status = "pending";
	scraper.status_message = "request sent";
	scraper.search(query).then(
		function (data) {
			scraper.status = "ok";
			scraper.status_message = "" + data.length + " torrents found";
			data.forEach( function(item) { item.scraper = scraper; } );
			allResults.push.apply(allResults, data);
			refreshResults();
			widgetContext.draw();
		}, function (err) {
			scraper.status = "error";
			scraper.status_message = err;
			widgetContext.draw();
		}
		
	);
})(); }


var resolveTorrentLink = function(torrent, callback) {
	if(torrent.torrent_link) {
		//console.log(encodeURI(torrent.torrent_link));
		setTimeout( function() { callback(true, torrent.torrent_link); }, 0 );
	} else if (torrent.torrent_site) {
		torrent_search.torrentSearch(encodeURI(torrent.torrent_site)).then(
			function(data) {
				torrent.torrent_link = data;
				callback(true);
			}, function(err) {
				callback(false, err);
			}
		);
	} else {
		callback(false, "", "don't know how to download this torrent");
	}
}
var processTorrent = function(torrent, callback) {
	if(!torrent.torrent_link) {
		logMessage("INFO", "parseTorrent", "Resolving torrent link...");
		resolveTorrentLink(torrent, function(success, err){
			if(success) processTorrent(torrent, callback);
			else callback(false, err);
		});
	}
	executeExternalCommand(torrent, callback);
}

var externalCommandRunning = false;
var ignoreSignal = function() {};

var executeExternalCommand = function(torrent, callback) {
	var spawn = require('child_process').spawn;
	process.stdin.setRawMode(false);
	var translatedCommand = externalCommand.map( function(item) {
		switch(item) {
			case "{}": return torrent.torrent_link;
			default: return item;
		}
	});
	logMessage("INFO", "executeExternalCommand", "Starting ext command...");
	setTimeout(function() { // delay execution so that the widget finishes impending drawing
		var child = spawn(translatedCommand[0], translatedCommand.slice(1), { stdio: "inherit" } );
		process.on('SIGINT', ignoreSignal);
		externalCommandRunning = true;
		child.on('close', function(code, signal) {
				console.log("");i // add extra "\n" to the child output else we will overwrite the last line
				logMessage("INFO", "executeExternalCommand", "Ext command result: " + code + ", " + signal);
				externalCommandRunning = false;
				process.stdin.setRawMode(true);
				process.removeListener('SIGINT', ignoreSignal);
				callback(true);
				});
	},0);
}

process.stdout.write("\u001b[?7l"); // disable line wrap (linewrap causes problems when resizing the window quickly: the widget is rendred with a size assumption but upon display it does not match the window size anymore)
process.on("exit", function() { process.stdout.write("\u001b[?7h"); }); // reenable linewrap on exit

process.stdin.setRawMode(true);
var stdinListener = function() {
	if(externalCommandRunning) return; // child process will process the input
        var key = process.stdin.read();
        if(key != null) {
                if(key.compare(new Buffer([ 3 ])) == 0) process.exit();
                else if(key.compare(new Buffer([ 9 ])) == 0) {
			widgetContext.setFocus( tabOrder[ (tabOrder.indexOf(widgetContext.focusedWidget) + 1) % tabOrder.length ] );
		}
                else widgetContext.handleKeyEvent(key);
                widgetContext.draw();
        }
};
process.stdin.on('readable', stdinListener);
process.stdout.on('resize', function() { if(externalCommandRunning) return; searchFieldInput.moveCursor({line: 0, column: 0}); widgetContext.draw(); });

widgetContext.draw();

