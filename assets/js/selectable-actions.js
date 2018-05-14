$(function () {
    $(".selectable-block .checkmark-button").click(function(e) {
        if (e.target.classList.contains("selected")) {
            e.target.classList.remove("selected");
            e.target.parentElement.classList.remove("selected");
        } else {
            e.target.classList.add("selected");
            e.target.parentElement.classList.add("selected");
        }
    });
});