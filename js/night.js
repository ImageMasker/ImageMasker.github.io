var isNight;
var toggleState = localStorage.getItem('Night');
if(toggleState == "true"){
    isNight = false;
    toggle();
}
function toggle() {
    if (isNight == true) {
        day();
    } else {
        night();
    }
}

function night() {
    localStorage.setItem("Night", true);
    var night = document.getElementsByClassName("color");
    for (i=0; i<night.length;i++) {
        night[i].classList.add("night");
    }
    var icon = document.getElementById("night");
    icon.innerHTML="🌞";
    icon.style.backgroundColor="rgb(55, 48, 77)";
    isNight = true;
}
function day() {
    localStorage.setItem('Night', false);
    var day = document.getElementsByClassName("color");
    for (i=0; i<day.length;i++) {
        day[i].classList.remove("night");
    }
    var icon = document.getElementById("night");
    icon.innerHTML="🌙";
    icon.style.backgroundColor="rgb(240, 214, 181)";
    isNight = false;
}