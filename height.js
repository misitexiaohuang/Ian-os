function convertHeightWeight(){


    let ft = Number(
        document.getElementById("height-ft").value
    );


    let inch = Number(
        document.getElementById("height-in").value
    );


    let lbs = Number(
        document.getElementById("weight-lbs").value
    );



    let cm = ft * 30.48 + inch * 2.54;


    let kg = lbs * 0.453592;



    document.getElementById("result").innerHTML =

    `
    身高：
    <strong>${cm.toFixed(1)} cm</strong>
    <br><br>
    体重：
    <strong>${kg.toFixed(1)} kg</strong>
    `;


}