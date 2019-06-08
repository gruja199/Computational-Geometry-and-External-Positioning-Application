const btnStartSession = document.getElementById("start-session");
const textStatus = document.getElementById("status");
const btnSaveCoords = document.getElementById("save-coords");
const btnEndSession = document.getElementById("end-session");
const ulSessions = document.getElementById("sessions-ul");
let polygonCoords = new Array();
let sessionCounter =
  localStorage.getItem("counter") == null ? 1 : localStorage.getItem("counter");

let coords = new Array();

function ConvexHullGrahamScan() {
  this.anchorPoint = undefined;
  this.reverse = false;
  this.points = [];
}

ConvexHullGrahamScan.prototype = {
  constructor: ConvexHullGrahamScan,

  Point: function(x, y) {
    this.x = x;
    this.y = y;
  },

  _findPolarAngle: function(a, b) {
    var ONE_RADIAN = 57.295779513082;
    var deltaX, deltaY;

    //if the points are undefined, return a zero difference angle.
    if (!a || !b) return 0;

    deltaX = b.x - a.x;
    deltaY = b.y - a.y;

    if (deltaX == 0 && deltaY == 0) {
      return 0;
    }

    var angle = Math.atan2(deltaY, deltaX) * ONE_RADIAN;

    if (this.reverse) {
      if (angle <= 0) {
        angle += 360;
      }
    } else {
      if (angle >= 0) {
        angle += 360;
      }
    }

    return angle;
  },

  addPoint: function(x, y) {
    //Check for a new anchor
    var newAnchor =
      this.anchorPoint === undefined ||
      this.anchorPoint.y > y ||
      (this.anchorPoint.y === y && this.anchorPoint.x > x);

    if (newAnchor) {
      if (this.anchorPoint !== undefined) {
        this.points.push(
          new this.Point(this.anchorPoint.x, this.anchorPoint.y)
        );
      }
      this.anchorPoint = new this.Point(x, y);
    } else {
      this.points.push(new this.Point(x, y));
    }
  },

  _sortPoints: function() {
    var self = this;

    return this.points.sort(function(a, b) {
      var polarA = self._findPolarAngle(self.anchorPoint, a);
      var polarB = self._findPolarAngle(self.anchorPoint, b);

      if (polarA < polarB) {
        return -1;
      }
      if (polarA > polarB) {
        return 1;
      }

      return 0;
    });
  },

  _checkPoints: function(p0, p1, p2) {
    var difAngle;
    var cwAngle = this._findPolarAngle(p0, p1);
    var ccwAngle = this._findPolarAngle(p0, p2);

    if (cwAngle > ccwAngle) {
      difAngle = cwAngle - ccwAngle;

      return !(difAngle > 180);
    } else if (cwAngle < ccwAngle) {
      difAngle = ccwAngle - cwAngle;

      return difAngle > 180;
    }

    return true;
  },

  getHull: function() {
    var hullPoints = [],
      points,
      pointsLength;

    this.reverse = this.points.every(function(point) {
      return point.x < 0 && point.y < 0;
    });

    points = this._sortPoints();
    pointsLength = points.length;

    //If there are less than 3 points, joining these points creates a correct hull.
    if (pointsLength < 3) {
      points.unshift(this.anchorPoint);
      return points;
    }

    //move first two points to output array
    hullPoints.push(points.shift(), points.shift());

    //scan is repeated until no concave points are present.
    while (true) {
      var p0, p1, p2;

      hullPoints.push(points.shift());

      p0 = hullPoints[hullPoints.length - 3];
      p1 = hullPoints[hullPoints.length - 2];
      p2 = hullPoints[hullPoints.length - 1];

      if (this._checkPoints(p0, p1, p2)) {
        hullPoints.splice(hullPoints.length - 2, 1);
      }

      if (points.length == 0) {
        if (pointsLength == hullPoints.length) {
          //check for duplicate anchorPoint edge-case, if not found, add the anchorpoint as the first item.
          var ap = this.anchorPoint;
          //remove any udefined elements in the hullPoints array.
          hullPoints = hullPoints.filter(function(p) {
            return !!p;
          });
          if (
            !hullPoints.some(function(p) {
              return p.x == ap.x && p.y == ap.y;
            })
          ) {
            hullPoints.unshift(this.anchorPoint);
          }
          return hullPoints;
        }
        points = hullPoints;
        pointsLength = points.length;
        hullPoints = [];
        hullPoints.push(points.shift(), points.shift());
      }
    }
  }
};

// EXPORTS

if (typeof define === "function" && define.amd) {
  define(function() {
    return ConvexHullGrahamScan;
  });
}
if (typeof module !== "undefined") {
  module.exports = ConvexHullGrahamScan;
}

function polygonCenter(poly) {
  var lowx,
    highx,
    lowy,
    highy,
    lats = [],
    lngs = [],
    vertices = poly.getPath();

  for (var i = 0; i < vertices.length; i++) {
    lngs.push(vertices.getAt(i).lng());
    lats.push(vertices.getAt(i).lat());
  }

  lats.sort();
  lngs.sort();
  lowx = lats[0];
  highx = lats[vertices.length - 1];
  lowy = lngs[0];
  highy = lngs[vertices.length - 1];
  center_x = lowx + (highx - lowx) / 2;
  center_y = lowy + (highy - lowy) / 2;
  return new google.maps.LatLng(center_x, center_y);
}

function distance(lat1, lat2, lng1, lng2) {
  var R = 6371e3; // metres
  var φ1 = lat1.toRadians();
  var φ2 = lat2.toRadians();
  var Δφ = (lat2 - lat1).toRadians();
  var Δλ = (lng2 - lng1).toRadians();

  var a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  var d = R * c;

  return d;
}

var map;

function initMap() {
  var a = 44.7691683,
    b = 17.1963833,
    diff = 0.0033,
    diff1 = 0.001;

  myPosition = { lat: 44.7691683, lng: 17.1963833 };
  var options = {
    center: myPosition,
    zoom: 9
  };

  /*
{ lat: 45.65073548771501, lng: 17.262804561503696 },
    { lat: 44.87246643765902, lng: 17.65216878385859 },
    { lat: 45.260352623146304, lng: 17.520152465966586 },
    { lat: 45.546629062806595, lng: 17.771663880855854 },
    { lat: 45.490992658811024, lng: 17.274138927275295 },
    { lat: 45.49967158928243, lng: 17.434832257826333 },
    { lat: 44.86880178939455, lng: 17.541199715540724 },
    { lat: 45.40527724168569, lng: 18.096072422345593 },
    { lat: 45.05481625494642, lng: 17.3107855884445 },
    { lat: 44.79539183919637, lng: 17.64353098754159 },
    { lat: 44.88994555906469, lng: 17.636302219442662 },
    { lat: 45.29742681187176, lng: 17.348273467576277 },
    { lat: 44.950312087809124, lng: 17.702872313689102 }

*/

  var polygonCordinates = [
    { lat: 45.65073548771501, lng: 17.262804561503696 },
    { lat: 45.546629062806595, lng: 17.771663880855854 },
    { lat: 45.40527724168569, lng: 18.096072422345593 },
    { lat: 44.79539183919637, lng: 17.64353098754159 },
    { lat: 44.86880178939455, lng: 17.541199715540724 },
    { lat: 45.05481625494642, lng: 17.3107855884445 },
    { lat: 45.490992658811024, lng: 17.274138927275295 }
  ];

  map = new google.maps.Map(document.getElementById("map"), options);
  infoWindow = new google.maps.InfoWindow();
  // Ovdje algoritam
  /*
 


 
*/
  var newPoll = [];
  for (let index = 0; index < polygonCoords.length - 1; index++) {
    newPoll.push(polygonCoords[index]);
  }

  var convexHull = new ConvexHullGrahamScan();

  newPoll.forEach(element => {
    convexHull.addPoint(element.lat, element.lng);
  });

  var hullPoints = convexHull.getHull();
  var Poll = [];
  var news = new Object();
  hullPoints.forEach(element => {
    news = {
      lat: element.x,
      lng: element.y
    };
    Poll.push(news);
  });

  console.log(newPoll);
  console.log(Poll);

  var polygon = new google.maps.Polygon({
    map: map,
    paths: Poll,
    strokeColor: "blue",
    fillColor: "blue",
    fillOpacity: 0.4,
    draggable: false,
    editable: false
  });

  newPoll.forEach(element => {
    var marker = new google.maps.Marker({
      position: element,
      map: map,
      title: "Hello World!"
    });
  });

  // Square Area
  //console.log(google.maps.geometry.spherical.computeArea(polygon.getPath()));
}

const getPosition = () => {
  const pArr = [];
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(p) {
        var position = {
          lat: p.coords.latitude,
          lng: p.coords.longitude
        };
        pArr.push(position);

        infoWindow.setPosition(position);
        infoWindow.setContent("Your location!");
        infoWindow.open(map);
        map.setCenter(position);
      },
      function() {
        handleLocationError("Geolocation service failed", map.getCenter());
      }
    );
  } else {
    handleLocationError("No geolocation available.", map.getCenter());
  }
  return pArr;
};

function handleLocationError(content, position) {
  infoWindow.setPosition(position);
  infoWindow.setContent(content);
  infoWindow.open(map);
}

btnStartSession.addEventListener("click", onSessionStart);
btnEndSession.addEventListener("click", onSessionEnd);
ulSessions.addEventListener("click", deleteListEl);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", onLoad);
}
btnSaveCoords.addEventListener("click", saveCoords);

function onLoad() {
  navigator.serviceWorker
    .register("sw.js")
    .then(registration => registration.update())
    .catch(err => "SW registration failed");
  if (window.innerWidth < 600) {
    btnStartSession.classList.replace("session-false", "session-true");
    // divMap.classList.replace("session-true", "session-false");
  } else {
  }
  let tasks;
  if (localStorage.getItem("tasks") === null) {
    tasks = [];
  } else {
    tasks = JSON.parse(localStorage.getItem("tasks"));
  }
  const counters = new Array();
  let areElements = tasks.length;
  // Fake uslov da li ima elemenata u listi
  if (areElements === 0) {
    ulSessions.innerHTML =
      "<li class='list-group-item text-info' id='warning'>No Elements in List!</li>";
  } else {
    tasks.forEach((task, index) => {
      counters.push(index + 1);
      ulSessions.innerHTML +=
        "<li class='list-group-item text-dark'><span class='text-small'>Session " +
        task[task.length - 1] +
        "</span><span id = '" +
        index +
        "' class='btn btn-sm btn-outline-danger ml-2 float-right deleteEl'>Delete</span><span id='" +
        index +
        "' class='btn btn-sm btn-outline-primary float-right viewEl'>View</span></li>";
    });
  }
}

function saveCoords() {
  if (1 == 0) {
    console.log("Malo");
  } else {
    coords.push(getPosition());
    coords.flat(Infinity);
  }
}

function onSessionStart(e) {
  textStatus.classList.replace("session-false", "session-true");
  btnSaveCoords.classList.replace("session-false", "session-true");
  btnEndSession.classList.replace("session-false", "session-true");
  e.target.classList.replace("session-true", "session-false");
}

function onSessionEnd(e) {
  if (ulSessions.firstChild.hasAttribute("id")) {
    ulSessions.firstChild.remove();
  }
  if (coords.length < 10) {
    const a = confirm(
      "There should be at least 10 saved coordinates, Do you wish to continue? :)"
    );
    if (a) {
    } else {
      textStatus.classList.replace("session-true", "session-false");
      btnSaveCoords.classList.replace("session-true", "session-false");
      btnStartSession.classList.replace("session-false", "session-true");
      btnEndSession.classList.replace("session-true", "session-false");
      coords = new Array();
    }
  } else {
    textStatus.classList.replace("session-true", "session-false");
    btnSaveCoords.classList.replace("session-true", "session-false");
    btnStartSession.classList.replace("session-false", "session-true");
    e.target.classList.replace("session-true", "session-false");
  }

  coords.push(sessionCounter);
  storeCounter(sessionCounter);
  storeTaskInLocalStorage(coords.flat(Infinity));

  ulSessions.innerHTML +=
    "<li class='list-group-item text-dark'><span class='text-small'>Session " +
    sessionCounter +
    "</span><span id='" +
    ulSessions.childElementCount +
    "' class='btn btn-sm btn-outline-danger ml-2 float-right deleteEl'>Delete</span><span id='" +
    ulSessions.childElementCount +
    "' class='btn btn-sm btn-outline-primary float-right viewEl'>View</span></li>";
  sessionCounter++;
  localStorage.setItem("counter", sessionCounter);
}
function deleteListEl(e) {
  if (e.target.classList.contains("viewEl")) {
    if (window.innerWidth < 600) {
      alert("Viewing sessions is only available in desktop mode!");
    } else {
      let tasks;
      if (localStorage.getItem("tasks") === null) {
        tasks = [];
      } else {
        tasks = JSON.parse(localStorage.getItem("tasks"));
      }

      tasks.forEach((task, index) => {
        if (index == e.target.id) {
          polygonCoords = task;
        }
      });
      // JUMP
      initMap();
    }
  }
  if (e.target.classList.contains("deleteEl")) {
    if (ulSessions.childElementCount === 1) {
      ulSessions.innerHTML =
        "<li class='list-group-item text-info' id='warning'>No Elements in List!</li>";
    }
    console.log(e.target.id);
    removeTaskFromLocalStorage(e.target.id);
    e.target.parentNode.remove();
  }
}
//Store Task

function storeCounter(counter) {
  localStorage.setItem("counter", counter);
}
function storeTaskInLocalStorage(task) {
  let tasks;
  if (localStorage.getItem("tasks") === null) {
    tasks = [];
  } else {
    tasks = JSON.parse(localStorage.getItem("tasks"));
  }

  tasks.push(task);

  localStorage.setItem("tasks", JSON.stringify(tasks));
}

//Remove From Local Storage
function removeTaskFromLocalStorage(sessionItem) {
  let sessions;
  if (localStorage.getItem("tasks") === null) {
    sessions = [];
  } else {
    sessions = JSON.parse(localStorage.getItem("tasks"));
  }
  sessions.forEach((session, index) => {
    console.log(sessionItem, index);
    if (sessionItem == index) {
      sessions.splice(index, 1);
    }
  });
  localStorage.setItem("tasks", JSON.stringify(sessions));
}
