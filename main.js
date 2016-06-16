
var torrent_search = require("torrentflix/lib/torrent_search.js");
var terminalWidgets = require("terminal-widgets");
var chalk = require('chalk');
var fileSizeParser = require('filesize-parser');
var dateParser = require("date.js");
var util = require("util");
var fs = require("fs");
var domain = require("domain");


var torrent_sources = {
	"kickass": { name: 'Kickass', url: "https://kat.cr" },
	"limetorrents": { name: 'LimeTorrents', url: "http://limetorrents.cc" },
	"extratorrent": { name: 'ExtraTorrent', url: "http://extratorrent.cc" },
	"strike": { name: 'GetStrike', url: "https://getstrike.net" },
	"yts": { name: 'YTS', url: "https://yts.ag" },
	"tpb": { name: 'The Pirate Bay', url: "https://thepiratebay.la" },
	"btdigg": { name: 'BTDigg', url: "https://btdigg.org" },
	"seedpeer": { name: 'Seedpeer', url: "http://seedpeer.eu" },
	"leetx": { name: '1337x', url: "https://1337x.to" },
	"nyaa": { name: 'Nyaa', url: "http://www.nyaa.se" },
	"tokyotosho": { name: 'Tokiotosho', url: "https://www.tokyotosho.info" },
	"cpasbien": { name: 'Cpasbien', url: "http://www.cpasbien.io" },
	"eztv": { name: 'Eztv', url: "https://www.eztv.ag" },
	"rarbg": { name: 'Rarbg', url: "https://torrentapi.org" },
	"torrentproject": { name: 'TorrentProject', url: "https://www.torrentproject.se" }
}


// extract sites urls
try {
	var script_config_vars = fs.readFileSync("node_modules/torrentflix/lib/cli.js", "utf-8");
	var str_config_vars = script_config_vars.match(/var config_vars = ({[\s\S]*?});/);
	var config_vars = eval("(" + str_config_vars[1] + ")");
	torrent_sources = config_vars.torrent_sources;
} catch(e) {
	console.log(chalk.yellow("Could not extract torrent sources urls from torrentflix, using hardcoded urls instead"));
	console.log(""); // added because the UI deletes one extra line (reason unknown)
}

var scrapers = [
	function() { var obj = require("torrentflix/lib/limetorrents.js"); return { name: "limetorrents", search: function(query) { return obj.search(query, torrent_sources["limetorrents"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/extratorrent.js"); return { name: "extratorrent", search: function(query) { return obj.search(query, torrent_sources["extratorrent"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/thepiratebay.js"); return { name: "thepiratebay", search: function(query) { return obj.search(query, torrent_sources["tpb"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/yts.js"); return { name: "yts", search: function(query) { return obj.search(query, torrent_sources["yts"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/btdigg.js"); return { name: "btdigg", search: function(query) { return obj.search(query, torrent_sources["btdigg"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/seedpeer.js"); return { name: "seedpeer", search: function(query) { return obj.search(query, torrent_sources["seedpeer"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/1337x.js"); return { name: "1337x", search: function(query) { return obj.search(query, torrent_sources["leetx"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/nyaa.js"); return { name: "nyaa", search: function(query) { return obj.search(query, torrent_sources["nyaa"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/strike.js"); return { name: "strike", search: function(query) { return obj.search(query, torrent_sources["strike"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/kickass.js"); return { name: "kickass", search: function(query) { return obj.search(query, torrent_sources["kickass"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/tokyotosho.js"); return { name: "tokyotosho", search: function(query) { return obj.search(query, torrent_sources["tokyotosho"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/cpasbien.js"); return { name: "cpasbien", search: function(query) { return obj.search(query, torrent_sources["cpasbien"].url); } }  }(),
	function() { var obj = require("torrentflix/lib/eztv.js"); return { name: "eztv", search: function(query) { return obj.search(query, torrent_sources["eztv"].url); } }  }()
];

//scrapers = [ scrapers[0] ];
//scrapers = [ ];

var results = [], allResults = [];

// ============
// UI
// ============
var widgetContext = new terminalWidgets.WidgetContext();
var uiWidth = function() {
	if(process.platform.startsWith("win")) return Math.min(100, process.stdout.columns); // on windows process.stdout.columns return the number of columns of the buffer, not the number of visible columns
	else return process.stdout.columns;
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
                render: function(item, width) { 

			return scraperStyle(scrapers[item].status) (terminalWidgets.padRight(scrapers[item].name + ": " + scrapers[item].status + ", " + scrapers[item].status_message, width)); 
		}
        });
var resultsMenuMaxTextScroll = 0, newResultsMenuMaxTextScroll = 0;
var resultsMenuRedrawTimeout = null;
var resultsMenu = new terminalWidgets.VMenu({
		width: function() { return uiWidth() - resultsMenuVScrollBar.callback.width();  },
		height: function() { return 10 - resultsMenuHScrollBar.callback.height(); },	
                itemsCount: function() { return results.length; },
                maxTextScroll: function() { return resultsMenuMaxTextScroll; },
                render: function(item, line, current, width, hScroll) {
			var torrent = results[item];
			var columnWidths = [ Math.floor(width*5/100), 1, 0, 1, Math.floor(width*5/100), 1, Math.floor(width*15/100), 1, Math.floor(width*15/100), 1, Math.floor(width*5/100), 1, Math.floor(width*5/100) ];
			columnWidths[2] = width - columnWidths.reduce(function(a,b) { return a + b; });
			newResultsMenuMaxTextScroll = Math.max(newResultsMenuMaxTextScroll, printable(torrent.title).length + width - columnWidths[2]);
			if(resultsMenuMaxTextScroll != newResultsMenuMaxTextScroll && !resultsMenuRedrawTimeout) {
				resultsMenuRedrawTimeout = setTimeout(function() {
					resultsMenuMaxTextScroll = newResultsMenuMaxTextScroll;
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

var resultsMenuVScrollBar = resultsMenu.newVScrollBar({
        height: function() { return resultsMenu.callback.height(); },
        width: function() { return (resultsMenu.callback.itemsCount() > resultsMenu.callback.height()) ? 1 : 0; },
        render: function(component, line, width) {
                return (component === 0 ? chalk.bgBlue : nostyle)(terminalWidgets.padRight("", width));
        }
});


var resultsMenuHScrollBar = resultsMenu.newHScrollBar({
        height: function() { return (resultsMenu.callback.maxTextScroll() > 0) ? 1 : 0; },
        width: function() { return resultsMenu.callback.width(); },
        render: function(component, line, width) {
                return (component === 0 ? chalk.bgBlue : nostyle)(terminalWidgets.padRight("", width));
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
		return item.title.toLowerCase().indexOf(searchFieldInputText[0].toLowerCase()) >= 0;
	});
	if(sortOptionSelected >= 0)
		results.sort( sortOptions[sortOptionSelected].compareFunction );
	resultsMenu.moveCurrentItem({ row: 0, col: 0 }); // refresh the view if needed
}
var sortOptionsMenu = new terminalWidgets.VMenu({
		width: function() { return uiWidth() - scrapersStatusLabel.callback.width();  },
		height: function() { return sortOptions.length; },
                itemsCount: function() { return sortOptions.length; },
                render: function(item, line, current, width, hScroll) {
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
                render: function(item, width) {
			return (widgetContext.focusedWidget === searchFieldInput ? chalk.white : chalk.gray)(searchFieldHeaderText);
		}
        });
var searchFieldInputText = [];
var searchFieldInput = new terminalWidgets.Input(searchFieldInputText, {
		width: function() { return Math.max(0, uiWidth() - searchFieldHeaderText.length);  },
		height: function() { return 1; },
		textMaxLines: function() { return 1 },
                render: function(component, line, start, width) {
                        return (widgetContext.focusedWidget === searchFieldInput ? chalk.white : chalk.gray)((component === 0 ? chalk.bgGreen : nostyle)(terminalWidgets.padRight(searchFieldInputText[line].substr(start, width), width)));
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
                render: function(item, width) {
			var line = debugMessages[(debugMessagesTop+item) % debugMessages.length] ? debugMessages[(debugMessagesTop+item) % debugMessages.length].message.replace(/\n/,"") : "";
			return chalk.yellow(terminalWidgets.padRight(line, width)); 
		}
        });

var resultsMenuScrollBarPad = new terminalWidgets.Label({
		width: function() { return resultsMenuVScrollBar.callback.width();  },
		height: function() { return resultsMenuHScrollBar.callback.height(); },
                render: function(item, width) {
			return terminalWidgets.padRight(" ", width); 
		}
        });

var layout = new terminalWidgets.VBoxLayout([
	new terminalWidgets.HBoxLayout([ scrapersStatusLabel, sortOptionsMenu ]), 
	new terminalWidgets.HBoxLayout([ resultsMenu, resultsMenuVScrollBar ]), 
	new terminalWidgets.HBoxLayout([ resultsMenuHScrollBar, resultsMenuScrollBarPad ]), 
	//resultsMenuHScrollBar,
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
	else if(["-h", "-?", "--help"].indexOf(process.argv[i]) >= 0) {
		console.log("Usage: " + process.argv[0] + " " + process.argv[1] + " query-string [--exec command [initial-arguments]]");
		console.log("    --exec command: command to start when selecting a torrent");
		console.log("       the command will be started with initial-arguments list, with {} replaced by the torrent link");
		console.log("    --help: this help");
		console.log("    --version: version number");
		process.exit(0); // EX_OK
	}
	else if(["-v", "--version"].indexOf(process.argv[i]) >= 0) {
		console.log(require("./package.json").version);
		process.exit(0); // EX_OK
	}
	else query = process.argv[i];
}

if(query === "") {
	console.error("Missing query-string, check usage with -h");
	process.exit(64); // EX_USAGE
}

if(externalCommand.length === 0) externalCommand = [ "echo", "{}" ];

var i;
for (i in scrapers) { (function() {
	var scraper = scrapers[i];
	var d = domain.create();
	scraper.status = "pending";
	scraper.status_message = "request sent";
	d.on('error', function(err) { 
		scraper.status = "error";
		scraper.status_message = err;
		widgetContext.draw();
	});
	d.run( function() {
		scraper.search(query).then(
			function (data) {
				scraper.status = "ok";
				scraper.status_message = "" + data.length + " torrents found";
				data.forEach( function(item) { item.scraper = scraper; } );
				allResults.push.apply(allResults, data);
				refreshResults();
				widgetContext.draw();
			}, function (err) {
				throw err;
			}
		);
	});
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
		return;
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
	widgetContext.draw();
	setTimeout(function() { // delay execution so that the widget finishes impending drawing
		var child = spawn(translatedCommand[0], translatedCommand.slice(1), { stdio: "inherit" } );
		process.on('SIGINT', ignoreSignal);
		externalCommandRunning = true;
		child.on('close', function(code, signal) {
				console.log("");i // add extra "\n" to the child output else we will overwrite the last line
				logMessage("INFO", "executeExternalCommand", "Ext command result: " + (signal || code));
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
                if(key.compare(new Buffer([ 3 ])) == 0) process.exit(0); // EX_OK
                else if(key.compare(new Buffer([ 9 ])) == 0) {
			widgetContext.setFocus( tabOrder[ (tabOrder.indexOf(widgetContext.focusedWidget) + 1) % tabOrder.length ] );
		}
                else widgetContext.handleKeyEvent(key);
                widgetContext.draw();
        }
};
process.stdin.on('readable', stdinListener);
process.stdout.on('resize', function() { if(externalCommandRunning) return; searchFieldInput.moveCursor({line: 0, col: 0}); widgetContext.draw(); });

widgetContext.draw();

