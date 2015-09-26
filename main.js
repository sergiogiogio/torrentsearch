
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

var results = [], allResults = [];

// ============
// UI
// ============
var widgetContext = new terminalWidgets.WidgetContext();
var uiWidth = 80;

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

var printable = function(str) {
	return (str || "").toString().trim().replace(/[^\x20-\x7E]/g, ".");
}

var scrapersStatusLabel = new terminalWidgets.Label(Math.floor(uiWidth*80/100), scrapers.length, {
                item: function(item, width) { 
			return scraperStyle(scrapers[item].status) (terminalWidgets.padRight(scrapers[item].name + ": " + scrapers[item].status + ", " + scrapers[item].status_message, width)); 
		}
        });
var resultsMenuScrollWidth = 0;
var resultsMenu = new terminalWidgets.Menu(uiWidth, 10, {
                itemsCount: function() { return results.length; },
                scrollWidth: function() { return resultsMenuScrollWidth; },
                item: function(item, current, width, hScroll) {
			var torrent = results[item];
			var columnWidths = [ Math.floor(width*5/100), 1, 0, 1, Math.floor(width*5/100), 1, Math.floor(width*15/100), 1, Math.floor(width*15/100), 1, Math.floor(width*5/100), 1, Math.floor(width*5/100) ];
			columnWidths[2] = width - columnWidths.reduce(function(a,b) { return a + b; });
			var prevResultsMenuScrollWidth = resultsMenuScrollWidth;	
			resultsMenuScrollWidth = Math.max(resultsMenuScrollWidth, printable(torrent.title).length + width - columnWidths[2]);
			if(resultsMenuScrollWidth != prevResultsMenuScrollWidth) {
				setTimeout(function() { widgetContext.draw(); }, 0);
			} // async redraw (we can redraw here
			//debugMessage = ("" + resultsMenu.hScrollPos + ", " + resultsMenuScrollWidth);
			


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
					if(success) {
						process.exit();
					} else {
						setDebugMessage("processTorrent", message, encodeURI(results[item].torrent_link || results[item].torrent_site));
						widgetContext.draw();
					}
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
		setDebugMessage("parseDate", e, str);
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
		setDebugMessage("parseFileSize", e, str);
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
		return item.title.toLowerCase().indexOf(searchFieldInput.lines[0].toLowerCase()) >= 0;
	});
	if(sortOptionSelected >= 0)
		results.sort( sortOptions[sortOptionSelected].compareFunction );
	resultsMenu.shiftVCursor(0); // refresh the view if needed
}
var sortOptionsMenu = new terminalWidgets.Menu(Math.floor(uiWidth*20/100), sortOptions.length, {
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

var layoutTopWidgets = [ scrapersStatusLabel, sortOptionsMenu ];
var layoutTop = new terminalWidgets.HBoxLayout({
                itemsCount: function() { return layoutTopWidgets.length; },
                item: function(item) { return layoutTopWidgets[item]; }
        });

var searchFieldHeaderText = "Search: ";
var searchFieldHeaderLabel = new terminalWidgets.Label(searchFieldHeaderText.length, 1, {
                item: function(item, width) {
			return (widgetContext.focusedWidget === searchFieldInput ? chalk.white : chalk.gray)(searchFieldHeaderText);
		}
        });
var searchFieldInput = new terminalWidgets.Input(uiWidth-searchFieldHeaderText.length, 1, {
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


var layoutSearchWidgets= [ searchFieldHeaderLabel, searchFieldInput ];
var layoutSearch = new terminalWidgets.HBoxLayout({
                itemsCount: function() { return layoutSearchWidgets.length; },
                item: function(item) { return layoutSearchWidgets[item]; }
        });


var debugMessage;
var setDebugMessage = function(module, message, data) {
	if(debugMessage === undefined) layoutWidgets.push(debugLabel);
	debugMessage = { date: new Date(), module: module, message: message, data: data };
}
var debugLabel = new terminalWidgets.Label(uiWidth, 3, {
                item: function(item, width) {
			var line = (item === 0) ? "" + debugMessage.date.toLocaleString() + " " + debugMessage.module :
				(item === 1) ? debugMessage.message :
				(item === 2) ? "data: " + debugMessage.data :
				"";
			return chalk.yellow(terminalWidgets.padRight(line, width)); 
		}
        });


var layoutWidgets = [ layoutTop, resultsMenu, layoutSearch ];
var layout = new terminalWidgets.VBoxLayout({
                itemsCount: function() { return layoutWidgets.length; },
                item: function(item) { return layoutWidgets[item]; }
        });





widgetContext.setWidget(layout);
widgetContext.setFocus(resultsMenu);

var tabOrder = [ resultsMenu, sortOptionsMenu, searchFieldInput ];

// ===================
// Main 
// ===================

if(process.argv.length < 3) {
	console.log("Usage: " + process.argv[0] + " " + process.argv[1] + " <query>");
	process.exit();
}


var query = process.argv[2];

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


var processTorrent = function(torrent, callback) {
	if(torrent.torrent_link) {
		console.log(encodeURI(torrent.torrent_link));
		callback(true, "");
	} else if (torrent.torrent_site) {
		torrent_search.torrentSearch(encodeURI(torrent.torrent_site)).then(
			function(data) {
				console.log(data);
				callback(true, "");
			}, function(err) {
				callback(false, err);
			}
		);
	} else {
		callback(false, "don't know how to download this torrent");
	}
}


process.stdin.setRawMode(true);
var stdinListener = function() {
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

widgetContext.draw();

