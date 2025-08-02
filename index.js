// Importing express module
const express = require("express");
const axios = require("axios");
const Storage = require('node-storage');
const fs = require('node:fs');

var config = new Storage('config/default.json');

var options = {
    xtreamServer : config.get('xtreamServer'),
    username : config.get('username'),
    password : config.get('password'),
    channelsServer : config.get('channelsServer'),
    vodPath : config.get('vodPath'),
    seriesPath : config.get('seriesPath'),
    subscribedMovies : config.get('subscribedMovies') ?? [],
    subscribedSeries : config.get('subscribedSeries') ?? [],
    subscribedRefreshInterval : config.get('subscribedRefreshInterval') ?? 21600000 // 6 hours 
}

const port = 80;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// For serving static html files
app.use(express.static('public'));
app.use('/assets',express.static('assets'));

var lastRefreshedMovies = 0;
var moviesData;
var lastRefreshedSeries = 0;
var seriesData;

app.get('/options', (req, res) => {

    return res.send(JSON.stringify(options));
})

app.post('/options', (req, res) => {
    console.log(req.body);
    options.xtreamServer = req.body.xtreamServer;
    options.username = req.body.username;
    options.password = req.body.password;
    options.vodPath = req.body.vodPath;
    options.seriesPath = req.body.seriesPath;
    config.put('xtreamServer',options.xtreamServer);
    config.put('username',options.username);
    config.put('password',options.password);
    config.put('vodPath',options.vodPath);
    config.put('seriesPath',options.seriesPath);
    return res.send("success");
});

app.get('/movies', async (req, res) => {
    console.log("Fetching movies");
    //http://localhost/movies?search=&offset=0&limit=10&searchable%5B%5D=stream_icon&searchable%5B%5D=name&searchable%5B%5D=rating_5based&searchable%5B%5D=stream_id
    await refreshMovieList();
    var moviesResult = moviesData;
    if(req.query.sort && req.query.order){
        moviesResult.sort(
            (a, b) => {
                const nameA = a[req.query.sort]; // ignore upper and lowercase
                const nameB = b[req.query.sort]; // ignore upper and lowercase
                if (nameA < nameB) {
                  return (req.query.order == 'asc') ? -1 : 1;
                }
                if (nameA > nameB) {
                  return (req.query.order == 'asc') ? 1 : -1;
                }
              
                // names must be equal
                return 0;
            });
    }
    moviesResult = moviesResult.filter((movie) => movie.name.toLowerCase().includes(req.query.search.toLowerCase()));
    const filteredCount = moviesResult.length;
    moviesResult = moviesResult.slice(req.query.offset,(+req.query.offset + +req.query.limit));
    for(const movieResult of moviesResult){
        movieResult.subscribed = (options.subscribedMovies.findIndex((movie) => movie.stream_id == movieResult.stream_id) > -1);
    }
    const results = {
        total: filteredCount,
        totalNotFiltered: moviesData.length,
        rows: moviesResult
    }
    return res.send(results);

});

app.get('/series', async (req, res) => {
    console.log("Fetching series");
    await refreshSeriesList();
    var seriesResult = seriesData;
    if(req.query.sort && req.query.order){
        seriesResult.sort(
            (a, b) => {
                const nameA = a[req.query.sort]; // ignore upper and lowercase
                const nameB = b[req.query.sort]; // ignore upper and lowercase
                if (nameA < nameB) {
                  return (req.query.order == 'asc') ? -1 : 1;
                }
                if (nameA > nameB) {
                  return (req.query.order == 'asc') ? 1 : -1;
                }
              
                // names must be equal
                return 0;
            });
    }
    seriesResult = seriesResult.filter((series) => series.name.toLowerCase().includes(req.query.search.toLowerCase()));
    const filteredCount = seriesResult.length;
    seriesResult = seriesResult.slice(req.query.offset,(+req.query.offset + +req.query.limit));
    for(const seriesResultRow of seriesResult){
        seriesResultRow.subscribed = (options.subscribedSeries.findIndex((series) => series.series_id == seriesResultRow.series_id) > -1);
    }
    const results = {
        total: filteredCount,
        totalNotFiltered: seriesData.length,
        rows: seriesResult
    }
    return res.send(results);

});

app.post('/movies/strm', async (req, res) => {
    const action = req.body.action;
    switch (action){
        case "subscribe":
            if(options.subscribedMovies.find((movie) => movie.stream_id == req.body.stream_id)){
                return res.send("already subscribed");
                    }
            await refreshMovieList();
            const movie =  moviesData.find((movie) => movie.stream_id == req.body.stream_id);

            try {
                const moviePath = options.vodPath + '/' + movie.name + '.strm';
                fs.writeFileSync(moviePath, options.xtreamServer + '/movie/' + options.username + '/' + options.password + '/' + movie.stream_id + '.' + movie.container_extension);
                const movieSubscription = {
                    stream_id: movie.stream_id,
                    path: moviePath
                }
                options.subscribedMovies.push(movieSubscription);
                config.put('subscribedMovies',options.subscribedMovies);
                return res.send("success");
            } catch (err) {
                console.error(err);
                return res.send(err);
            }
            break;
        case "unsubscribe":
            movieIndex = options.subscribedMovies.findIndex((movie) => movie.stream_id == req.body.stream_id);
            if(movieIndex < 0){
                return res.send("subscription not found");
            }
            fs.rmSync(options.subscribedMovies[movieIndex].path);
            options.subscribedMovies.splice(movieIndex,1);
            config.put('subscribedMovies',options.subscribedMovies);
            break;
        default:
            return res.send("action was not provided");
}
});

app.post('/series/strm', async (req, res) => {
    const action = req.body.action;
    switch (action){
        case "subscribe":
            if(options.subscribedSeries.find((series) => series.series_id == req.body.series_id)){
                return res.send("already subscribed");
            }
            await refreshSeriesList();
            return await res.send(subscribeToSeries(req.body.series_id));
            break;
        case "unsubscribe":
            seriesIndex = options.subscribedSeries.findIndex((series) => series.series_id == req.body.series_id);
            if(seriesIndex < 0){
                return res.send("subscription not found");
            }
            console.log(seriesIndex)
            console.log(options.subscribedSeries[seriesIndex])
            fs.rmSync(options.subscribedSeries[seriesIndex].path,{recursive: true});
            options.subscribedSeries.splice(seriesIndex,1);
            config.put('subscribedSeries',options.subscribedSeries);
            return res.send("unsubscribed");
            break;
        default:
            return res.send("action was not provided");
            
    }
    

   
});

async function subscribeToSeries(series_id){
    const series =  seriesData.find((series) => series.series_id == series_id);

            const thisSeriesPath = `${options.seriesPath}/${series.name} (${series.releaseDate.substring(0,4)})`;
            createSeriesFiles(series_id, thisSeriesPath);
            const seriesSubscription = {
                series_id: series.series_id,
                last_modified: series.last_modified,
                path: thisSeriesPath
            }
            options.subscribedSeries.push(seriesSubscription);
            config.put('subscribedSeries',options.subscribedSeries);

            
}

async function refreshMovieList(force){
    if(lastRefreshedMovies < (Date.now() - 240000) || force){
    await axios.get(options.xtreamServer + '/player_api.php?username=' + options.username + '&password=' + options.password + '&action=get_vod_streams')
    .then(function (response) {
        // handle success
        //console.log(response.data);
        moviesData = response.data;
        lastRefreshedMovies = Date.now();
      })
      .catch(function (error) {
        // handle error
        console.log(error);
        return res.send(error)
        
      })
      .finally(function () {
        // always executed
      });
}
}

async function createSeriesFiles(series_id, path){
    await axios.get(options.xtreamServer + '/player_api.php?username=' + options.username + '&password=' + options.password + '&action=get_series_info' + '&series_id=' + series_id)
            .then(function (response) {
                // handle success
                //console.log(response.data);
                episodesData = response.data.episodes;
                for (const season in episodesData){
                    const seasonPath = path + '/Season ' + season;
                    fs.mkdirSync(seasonPath, { recursive: true });
                    episodesData[season].forEach((episode) => {
                        console.log(`Series ${season}, Episode: ${episode.episode_num}`);
                        try {
                            fs.writeFileSync(seasonPath + '/' + season + 'x' + episode.episode_num + '.strm', options.xtreamServer + '/series/' + options.username + '/' + options.password + '/' + episode.id + '.' + episode.container_extension);
                            
                        } catch (err) {
                            console.error(err);
                            
                        }
                    })
                }

            return "success";
            })
            .catch(function (error) {
                // handle error
                console.log(error);
                return error;
                
            })
            .finally(function () {
                //return res.send("success");
            });
}

async function refreshSeriesList(force){
    if(lastRefreshedSeries < (Date.now() - 240000) || force){
    await axios.get(options.xtreamServer + '/player_api.php?username=' + options.username + '&password=' + options.password + '&action=get_series')
    .then(function (response) {
        // handle success
        //console.log(response.data);
        seriesData = response.data;
        lastRefreshedSeries = Date.now();
      })
      .catch(function (error) {
        // handle error
        console.log(error);
        return error;
        
      })
      .finally(function () {
        // always executed
      });
}
}





async function updateSubscriptions(){
    await refreshSeriesList();
    var updatesOccurred = false;
    for(const subscribedSeries of options.subscribedSeries){
        //console.log(subscribedSeries);
        const lastUpdatedTimestamp = seriesData.find((series) => series.series_id == subscribedSeries.series_id).last_modified;
        if(lastUpdatedTimestamp > subscribedSeries.last_modified){
            console.log("series has been updated, recreating files"); 
            await createSeriesFiles(subscribedSeries.series_id,subscribedSeries.path);
            subscribedSeries.last_modified = lastUpdatedTimestamp;
            config.put('subscribedSeries',options.subscribedSeries);
            updatesOccurred = true;
        } else {
            console.log(`no update for series ${subscribedSeries.series_id}`);
        }
    }
    if(updatesOccurred){
        console.log("Calling Channels DVR to refresh media");
        axios.put('http://dvr-channels.local:8089/dvr/scanner/scan');
    }
}

updateSubscriptions();
const subscribedRefreshInterval = setInterval(() => {
    updateSubscriptions();

  }, options.subscribedRefreshInterval);

// Starting the xtreamServer on the 80 port
app.listen(port, () => {
    console.log(`The application started
                 successfully on port ${port}`);
});