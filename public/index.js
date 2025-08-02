/* global bootstrap: false */
(() => {
  'use strict'
  const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl)
  })
})()

const xtreamServerInput = document.getElementById('xtreamServerInput');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const vodPathInput = document.getElementById('vodPathInput');
const seriesPathInput = document.getElementById('seriesPathInput');

getOptions();

function getOptions(){
  fetch('../options', {
    method: 'get'
})
.then(response => response.json())
.then(jsonData => {
  console.log(jsonData);
 xtreamServerInput.value = jsonData.xtreamServer;
 usernameInput.value = jsonData.username;
 passwordInput.value = jsonData.password;
 vodPathInput.value = jsonData.vodPath;
 seriesPathInput.value = jsonData.seriesPath;
})

.catch(err => {
        //error block
    })
};

function saveOptions(){
const optionsBody = {
  xtreamServer : xtreamServerInput.value,
  username : usernameInput.value,
  password : passwordInput.value,
  vodPath : vodPathInput.value,
  seriesPath : seriesPathInput.value
};
  fetch('../options', {
    method: 'post',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(optionsBody)
})
.then(response => response.json())
.then(jsonData => {
  console.log(jsonData)})

.catch(err => {
        //error block
    })

}

imageFormatter = (value, row) => {
  return `<img src='${value}' width=100>`
}

ratingFormatter = (value, row, index, field) => {
  const type = row.series_id ? "series" : "movie";
  return `<input id="${type}_${index}_rating" value="${parseFloat(value)}" type="text" class="rating-stars" data-theme="krajee-svg" data-min=0 data-max=5 data-step=0.1 data-size="lg"
  title="${parseFloat(value)} stars">`
};

dateStringFormatter = (value, row) => {
  try{
  return new Date(value).toLocaleDateString();
} catch {
  return null;
}
};

epochFormatter = (value, row) => {
  try{
  return new Date(parseInt(value)*1000).toLocaleDateString();
} catch {
  return null;
}
};

function subMovies(stream_id, action){
  fetch('../movies/strm', {
    method: 'post',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({stream_id: stream_id, action: action})
  })
  .then(response => response.json())
  .then(jsonData => {
    console.log(jsonData)})

  .catch(err => {
          //error block
      })
}

function subSeries(series_id, action){
  fetch('../series/strm', {
    method: 'post',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({series_id: series_id, action: action})
  })
  .then(response => response.json())
  .then(jsonData => {
    console.log(jsonData)})

  .catch(err => {
          //error block
      })
}

function getMovies(){
$('#seriesContainer').addClass('d-none');
$('#moviesContainer').removeClass('d-none');
$('#moviesTable').bootstrapTable('refresh',{ url: '../movies'});
}

function getSeries(){
  $('#moviesContainer').addClass('d-none');
  $('#seriesContainer').removeClass('d-none');
  $('#seriesTable').bootstrapTable('refresh',{ url: '../series'});
}


$('#moviesTable').bootstrapTable({
  columns: [{
    field: 'subscribed',
    checkbox: true
  },{
    field: 'stream_icon',
    title: 'Image',
    formatter: 'imageFormatter',
    searchable: false,
    width: 110
  }, {
    field: 'name',
    title: 'Title',
    sortable: true
  }, {
    field: 'rating_5based',
    title: 'Rating',
    formatter: 'ratingFormatter',
    searchable: false,
    sortable: true
  }

],
  pagination: true,
  sidePagination: 'server',
  search: true,
  checkboxHeader: false,
  onLoadSuccess: initialiseRatings,
  onCheck: function(row) {subMovies(row.stream_id,'subscribe')},
  onUncheck: function(row) {subMovies(row.stream_id,'unsubscribe')},
});

$('#seriesTable').bootstrapTable({
  columns: [{
    field: 'subscribed',
    checkbox: true
  },{
    field: 'cover',
    title: 'Image',
    formatter: 'imageFormatter',
    searchable: false,
    width: 110
  }, {
    field: 'name',
    title: 'Title',
    sortable: true
  }, {
    field: 'rating_5based',
    title: 'Rating',
    formatter: 'ratingFormatter',
    searchable: false,
    sortable: true
  },{
    field: 'releaseDate',
    title: 'Release Date',
    searchable: false,
    sortable: true,
    formatter: 'dateStringFormatter'
  },{
    field: 'last_modified',
    title: 'Last Updated',
    searchable: false,
    sortable: true,
    formatter: 'epochFormatter'
  },{
    field: 'plot',
    title: 'Description',
    searchable: false
  }

],
  pagination: true,
  sidePagination: 'server',
  search: true,
  checkboxHeader: false,
  onLoadSuccess: initialiseRatings,
  onCheck: function(row) {subSeries(row.series_id,'subscribe')},
  onUncheck: function(row) {subSeries(row.series_id,'unsubscribe')},
});

function initialiseRatings(){
  $('.rating-stars').rating({
    'displayOnly': true,
    'showCaption': false,
    'showCaptionAsTitle': true
  });
}