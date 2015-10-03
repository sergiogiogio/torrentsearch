# torrentsearch

A command line tool to search torrents in popular tracker sites and returning their link or magnets.
The sites covered are the ones from https://github.com/ItzBlitz98/torrentflix

Main features:
* command line based
* simultaneous search across all sites
* sort by size, seeds, age
* ability to refine search results via search field
* launch any command upon selection

![Screenshot](https://raw.githubusercontent.com/sergiogiogio/torrentsearch/master/screenshots/torrentsearch.png)

# installation
Local installation:
```
npm install torrentsearch
```
Or, global installation

```
npm install -g torrentsearch
```

# run
Local installation:
```
node_modules/torrentsearch/bin/torrentsearch <search-query> --exec <command>
```
Or, global instllation
```
torrentsearch <search-query> --exec <command>
```
--exec enables to run any common upon torrent selection. The string {} will be replaced with the torrent link

# example
Search for Big Bucks Bunny and use aria2c to download the selected file
```
torrentsearch "Big Bucks Bunny" --exec aria2c {}
```
