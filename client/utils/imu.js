window.addEventListener("deviceorientation", handleOrientation, true);
window.addEventListener("deviceMotion", handleMotion, true);
function handleOrientation(event) {
    var orientationInfo={
        x:event.beta,
        y:event.gamma,
        z:event.alpha
    };
    console.log(event);
}
function handleMotion(event) {
    console.log(event);
}