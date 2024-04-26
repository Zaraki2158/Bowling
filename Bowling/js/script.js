
const borneVue=20;//amplitude de deplacement de la camera
const R = 0.108;//rayon de la boule
const pas = 20/100;//distance parcourue par la boule à chaque déplacement
const distanceMaxTrajet = 10.2;//coordonnées x où la boule s'arrête (et disparait)
const e = 0.0000001;
const scene = new THREE.Scene(); 
const nbsPts = 200; //nb de points par courbe de Bézier
const bleu = new THREE.Color(0x003cff);//"#003cff";
const rouge = new THREE.Color(0xed0c0c); //"#ed0c0c";

function init(){
 var stats = initStats();
    // creation de rendu et de la taille
 let rendu = new THREE.WebGLRenderer({ antialias: true });
 rendu.shadowMap.enabled = true;
 const fond = new THREE.Color(0x6686d1);
 scene.background = fond;
 const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
 rendu.shadowMap.enabled = true;
 rendu.setClearColor(new THREE.Color(0xFFFFFF));
 rendu.setSize(window.innerWidth*.9, window.innerHeight*.9);
 cameraLumiere(scene,camera);
 lumiere(scene);
 //repere(scene);


 const size = 50;
const divisions = 50;

const gridHelper = new THREE.GridHelper( size, divisions , 0xffa44f , 0xffa44f);
gridHelper.rotateX(Math.PI/2);
gridHelper.position.set(0,0,-R*2);
scene.add( gridHelper );
  
  camera.position.x = -11;
  camera.position.y = 0.01;
  camera.position.z = 3.1;

  //variables pour l'affichage des aides (courbes,droite,points)
  var ligne = null;
  var courbe1 = null;
  var courbe2 = null;
  //points de contrôle et de jointure G1 de la courbe de Bézier
  let pt1 = null;
  let pt2 = null;
  let pt3 = null;
  //tableaux de points utilisés pour déplacer la boule dans le tir Bézier
  var tabPoints1 = [];
  var tabPoints2 = [];
  var pointsCourbes = [];
  
  
  //variables courantes de la boule et du groupe de quilles
  var boule = creerBoule(rouge);
  var quilles = placerQuille();

  //variables utiles pour le déroulement du jeu (score,tir courant et totaux)
  var nbPoints=0;
  var nbTire = 0;
  var nbTireTotal = 0;
  var totalBleu = 0;
  var totalRouge = 0;

  //ajout sur la scène de la piste des quilles et de la boule
  scene.add(creerPiste());
  scene.add(quilles);
  scene.add(boule);

  //coordonnées des points de la jointure G1
  let xp1D = 0;
  let yp1D = 0;
  let xp2D = 0;
  let yp2D = 0;
  let xp3D = 0;
  let yp3D = 0;

  
  
 
 //********************************************************
 //
 //  D E B U T     M E N U     G U I
 //
 //********************************************************
var gui = new dat.GUI();//interface graphique utilisateur
// ajout du menu dans le GUI
let menuGUI = new function () {
//caméra
  this.cameraxPos = camera.position.x;
  this.camerayPos = camera.position.y;
  this.camerazPos = camera.position.z;
  this.cameraZoom = 1.3;
  this.cameraxDir = 0;
  this.camerayDir = 0;
  this.camerazDir = 0;

//lancer rectiligne
  this.depart = 0.01;//= this.yp0
  this.viser = 0.01;//=this.yp4

//lancer bézier
  //this.xp0 = -10
  this.xp1 = 0;
  this.yp1 = 0;
  this.k = 0;
  this.xp2 = 0;
  this.yp2 = 0;
  this.xp3 = 0;
  this.yp3 = 0;
  //this.xp4 = distanceMaxTrajet

//compteurs
  this.i = 0;
  this.j = 0;

//utilisé dans le cas où la boule tombe dans une gouttière
  this.delta = 0;

//*************************************************************************
//TIRE RECTILIGNE
  this.tireRectiligne = function () {
  supprAides();
  menuGUI.i = -10; //valeur de x au point de départ
  menuGUI.delta = 0; 
  //setInterval(fonction,temps) la fonction se lance toutes les x millisecondes
  var positionRect = setInterval(() => {
      //si la boule est sur la piste et qu'elle n'a pas atteint le bout de la piste
      if(boule.position.y >-0.5 && boule.position.y <0.5 && boule.position.x < distanceMaxTrajet)
      {
        //on test à partir de 18 mètres parcouru sur la piste si la boule touche une quille
        if(boule.position.x>8) toucheQuille();
        //fonction qui déplace la boule
        roule(this.i,-10,this.depart,this.viser,0);
        this.i+=pas;
      }
      else
      {
        //si la boule tombe dans une gouttière
        if(this.i<distanceMaxTrajet)
        {
          //gouttière de gauche
          if(boule.position.y > 0) {this.delta = 0.5 + 0.235/2;}
          //gouttière de droite
          else {this.delta = -0.5-0.235/2;}
          //la boule continue son chemin dans la gouttière
          roule(this.i,boule.position.x,this.delta,this.delta,R);
          this.i+=pas;
        }
        else
        {
          //la boule a atteint le bout de la piste
          if(this.i>=distanceMaxTrajet)
          { 
            //notre tir est finis
            nbTire++;
            //calcul des points/scores des équipes et redéfinition de la boule si besoin
            jeu();
            //repositionnement de la boule
            boule.position.set(-10,this.depart,R);
            //pour que la fonction dans l'interval s'arrête
            clearInterval(positionRect);
          }
        }
      }
  //25 millisecondes entre chaque appel de la fonction    
  },25);
  };
   
//FIN TIRE RECTILIGNE
//*************************************************************************

//*************************************************************************
//TIRE BEZIER
  this.tireBezier = function () {
  supprAides(); 
  //récupération des tableaux de points des 2 courbes de Bézier
  pointsCourbes = [];
  pointsCourbes = pointsCourbes.concat(tabPoints1);
  pointsCourbes = pointsCourbes.concat(tabPoints2);

  menuGUI.delta = 0;
  menuGUI.i = 0; //initialisation du compteur
  menuGUI.j = -10; //valeur de x au point de départ
  var positionBezier = setInterval(() => {
    //si la boule est sur la piste et qu'elle n'a pas atteint le bout de la piste
    if(boule.position.y >-0.5 && boule.position.y <0.5 && boule.position.x < distanceMaxTrajet)
    {
      if(this.i<pointsCourbes.length)
      {
        //on test à partir de 18 mètres parcouru sur la piste si la boule touche une quille
        if(boule.position.x>8) toucheQuille();

        let p = new THREE.Vector3(0,0,0); //déclaration d'un vecteur position
        p = pointsCourbes[this.i]; //parcours des points des courbes
        //déplacement de la boule
        if(boule) scene.remove(boule);
        boule.position.set(p.x,p.y,R);
        scene.add(boule);
        //incrémentation du compteur
        this.i += 1;
        //actualisation de la valeur de x
        this.j = boule.position.x;
      }
    }
    else
      {this.i = pointsCourbes.length;//les courbes ne sont plus parcourues
        //si la boule tombe dans une gouttière
        if(this.j<=distanceMaxTrajet)
        {
          //pareil au tir rectiligne
          if(boule.position.y > 0) {this.delta = 0.5 + 0.235/2;}
          else {this.delta = -0.5-0.235/2;}
          roule(this.j,boule.position.x,this.delta,this.delta,R);
          this.j+=pas;
        }
        else
        {
          //si la boule a atteint la fin de la piste
          if(this.i>=pointsCourbes.length)
          {
            //notre tir est finis
            nbTire++;
            //calcul des points/scores des équipes et redéfinition de la boule si besoin
            jeu();
            //repositionnement de la boule
            boule.position.set(-10,this.depart,R);
            //pour que la fonction dans l'interval s'arrête
            clearInterval(positionBezier);
          }
        }
      }
    },10);
  };
//FIN TIRE BEZIER
//*************************************************************************

  //pour actualiser dans la scene   
  this.actualisation = function () {
  posCamera();
  reAffichage();
    }; // fin this.actualisation
  }; // fin de la fonction menuGUI

// ajout de la camera dans le menu, fonction dans le fichier cameraLumiere.js
  ajoutCameraGui(gui,menuGUI,camera);

//*******************************************************************//
//MENU GUI LANCER RECTILIGNE
let guiRectiligne = gui.addFolder("Lancer Rectiligne");

guiRectiligne.add(menuGUI,"depart",-0.49,0.49).onChange(function(){
  supprAides();
  //réaffichage de la ligne à chaque actualisation
  ligne = dessinerLigne(menuGUI.depart,menuGUI.viser);
  scene.add(ligne);
  //la boule se déplace avec le point de départ
  if(boule) scene.remove(boule);
  boule.position.set(-10,menuGUI.depart,R);
  scene.add(boule);
  }).name("Départ");

guiRectiligne.add(menuGUI,"viser",-2.0,2.0).onChange(function(){
  supprAides();
  //réaffichage de la ligne à chaque actualisation
  ligne = dessinerLigne(menuGUI.depart,menuGUI.viser);
  scene.add(ligne);
  }).name("Arrivée");

//ajout du menu pour tirer
guiRectiligne.add(menuGUI,"tireRectiligne").name("Tirer");

//FIN MENU GUI LANCER RECTILIGNE
//*******************************************************************//



//*******************************************************************//
//MENU GUI LANCER BEZIER
let guiBezier = gui.addFolder("Lancer Bézier");

//déplacement en y du point de départ
guiBezier.add(menuGUI,"depart",-0.49,0.49).onChange(function(){
  supprAides();

  [courbe1,tabPoints1] = dessinerCourbe(-10,menuGUI.depart,menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,nbsPts);
  [courbe2,tabPoints2] = dessinerCourbe(menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3,distanceMaxTrajet,menuGUI.viser,nbsPts);
  dessinerPoint(menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3);

  scene.add(courbe1);
  scene.add(courbe2);
  if(boule) scene.remove(boule);
  boule.position.set(-10,menuGUI.depart,R);
  scene.add(boule);
}).name("Départ");

//déplacement en x de 1er point
guiBezier.add(menuGUI,"xp1",-10,0).onChange(function(){
  supprAides();
  menuGUI.xp3 -= menuGUI.xp1 - xp1D;

  actuPoints();
  [courbe1,tabPoints1] = dessinerCourbe(-10,menuGUI.depart,menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,nbsPts);
  [courbe2,tabPoints2] = dessinerCourbe(menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3,distanceMaxTrajet,menuGUI.viser,nbsPts);
  dessinerPoint(menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3);

  scene.add(courbe1);
  scene.add(courbe2);
}).name("xP1");

//déplacement en y de 1er point
guiBezier.add(menuGUI,"yp1",-2,2).onChange(function(){
  supprAides();
  menuGUI.yp3 -= menuGUI.yp1 - yp1D;

  actuPoints();
  [courbe1,tabPoints1] = dessinerCourbe(-10,menuGUI.depart,menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,nbsPts);
  [courbe2,tabPoints2] = dessinerCourbe(menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3,distanceMaxTrajet,menuGUI.viser,nbsPts);

  dessinerPoint(menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3);

  scene.add(courbe1);
  scene.add(courbe2);
}).name("yP1");

//déplacement en x de 2e point
guiBezier.add(menuGUI,"xp2",-5,5).onChange(function(){
  supprAides();
  menuGUI.xp1 += menuGUI.xp2 - xp2D;  //calcul le déplacement en x depuis le point de départ
  menuGUI.xp3 += menuGUI.xp2 - xp2D;  //et l'applique aux points alignés
  
  actuPoints();

  [courbe1,tabPoints1] = dessinerCourbe(-10,menuGUI.depart,menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,nbsPts);
  [courbe2,tabPoints2] = dessinerCourbe(menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3,distanceMaxTrajet,menuGUI.viser,nbsPts);
  dessinerPoint(menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3);

  scene.add(courbe1);
  scene.add(courbe2);
}).name("xP2");

//déplacement en y de 2e point
guiBezier.add(menuGUI,"yp2",-2,2).onChange(function(){
  supprAides();
  menuGUI.yp1 += menuGUI.yp2 - yp2D;  //calcul le déplacement en y depuis le point de départ
  menuGUI.yp3 += menuGUI.yp2 - yp2D;  //et l'applique aux points alignés
  
  actuPoints();

  [courbe1,tabPoints1] = dessinerCourbe(-10,menuGUI.depart,menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,nbsPts);
  [courbe2,tabPoints2] = dessinerCourbe(menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3,distanceMaxTrajet,menuGUI.viser,nbsPts);
  dessinerPoint(menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3);

  scene.add(courbe1);
  scene.add(courbe2);
}).name("yP2");

//déplacement en x de 3e point
guiBezier.add(menuGUI,"xp3",0,10).onChange(function(){
  supprAides();
  menuGUI.xp1 -= menuGUI.xp3 - xp3D;

  actuPoints();
  [courbe1,tabPoints1] = dessinerCourbe(-10,menuGUI.depart,menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,nbsPts);
  [courbe2,tabPoints2] = dessinerCourbe(menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3,distanceMaxTrajet,menuGUI.viser,nbsPts);
  dessinerPoint(menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3);

  scene.add(courbe1);
  scene.add(courbe2);
}).name("xP3");

//déplacement en y de 3e point
guiBezier.add(menuGUI,"yp3",-2,2).onChange(function(){
  supprAides();
  menuGUI.yp1 -= menuGUI.yp3 - yp3D;


  actuPoints();

  [courbe1,tabPoints1] = dessinerCourbe(-10,menuGUI.depart,menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,nbsPts);
  [courbe2,tabPoints2] = dessinerCourbe(menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3,distanceMaxTrajet,menuGUI.viser,nbsPts);
  dessinerPoint(menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3);

  scene.add(courbe1);
  scene.add(courbe2);
}).name("yP3");

//déplacement en y du point d'arrivée
guiBezier.add(menuGUI,"viser",-2,2).onChange(function(){
  supprAides();

  [courbe1,tabPoints1] = dessinerCourbe(-10,menuGUI.depart,menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,nbsPts);
  [courbe2,tabPoints2] = dessinerCourbe(menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3,distanceMaxTrajet,menuGUI.viser,nbsPts);
  dessinerPoint(menuGUI.xp1,menuGUI.yp1,menuGUI.xp2,menuGUI.yp2,menuGUI.xp3,menuGUI.yp3);

  scene.add(courbe1);
  scene.add(courbe2);
}).name("Arrivée");

//ajout du bouton pour tirer
guiBezier.add(menuGUI, "tireBezier").name("Tirer");

//guiBezier.open();
//guiRectiligne.open();


//FIN MENU GUI LANCER BEZIER
//*******************************************************************//


//ajout du menu pour actualiser l'affichage 
  gui.add(menuGUI, "actualisation");
  menuGUI.actualisation();

//**********************************************************************
//
//  F I N     M E N U     G U I
//
//**********************************************************************


renduAnim();

//actualise la position de départ de tous les points qui ont été déplacé
function actuPoints(){
  xp2D = menuGUI.xp2;
  yp2D = menuGUI.yp2;
  xp1D = menuGUI.xp1;
  yp1D = menuGUI.yp1;
  xp3D = menuGUI.xp3;
  yp3D = menuGUI.yp3;
}

//permet de faire avancer la boule de pas à pas depuis une équation de droite
function roule(i,departX,departY,arriveeY,r){
  if( arriveeY != 0 )
    [pente,ord] = droite(new THREE.Vector3(departX,departY,R),new THREE.Vector3(distanceMaxTrajet,arriveeY,R));
  else
    [pente,ord] = [0,0];

  if(boule) scene.remove(boule);
  boule.position.set(i,(pente*i+ord),R-r);
  scene.add(boule);    
  }


/*
        7   8   9   10
          4   5   6
            2   3
              1

Quille1 : [ [2,4,7] , [5] , [3,6,10] ]
Quille2 : [ [4,7] , [8] , [5,9] ]
Quille3 : [ [5,8] , [9] , [6,10] ]
Quille4 : [ [7] , [] , [8] ]
Quille5 : [ [8] , [] , [9] ]
Quille6 : [ [9] , [] , [10] ]
Quille7 : [ [] , [] , [] ]
Quille8 : [ [] , [] , [] ]
Quille9 : [ [] , [] , [] ]
Quille10 : [ [] , [] , [] ]
*/

//retourne la liste des quilles voisines à une entré en paramètre
//cas = 1 alors les quilles sont derrières
//cas = 2 alors les quilles sont à gauche
//cas = 3 alors les quilles sont à droite
function quillesVoisine(n,cas)
{ n +=1; 
  let L = [];
  switch(cas)
  {
    case 1 :  if(n == 1) L.push(5);
              if(n == 2) L.push(8);
              if(n == 3) L.push(9);
              break;
    case 2 :  if(n == 1) {L.push(2);L.push(4);L.push(7);}
              if(n == 2) {L.push(4);L.push(7);}
              if(n == 3) {L.push(5);L.push(8);}
              if(n == 4) L.push(7);
              if(n == 5) L.push(8);
              if(n == 6) L.push(9);
              break;
    case 3 :  if(n == 1) {L.push(3);L.push(6);L.push(10);}
              if(n == 2) {L.push(5);L.push(9);}
              if(n == 3) {L.push(6);L.push(10);}
              if(n == 4) L.push(8);
              if(n == 5) L.push(9);
              if(n == 6) L.push(10);
              break;
  }
  return L;
    
}

//permet de savoir si la boule entre en collision avec une quille
function toucheQuille(){
  //récupération de la position de la boule
  let v1 = new THREE.Vector3(boule.position.x,boule.position.y,0);
  let q = [];
  q= quilles.children;
  let v2 = new THREE.Vector3();

  //on place 3 points à l'avant de la boule pour connaître la direction de l'impact
  let gauche = new THREE.Vector3(boule.position.x + R , boule.position.y-R/2 ,0);
  let milieu = new THREE.Vector3(boule.position.x + R , boule.position.y ,0);
  let droite = new THREE.Vector3(boule.position.x + R , boule.position.y+R/2 ,0);
  let Q = [];
  
  for(n=0;n<10;n++)
  {
    //récupération de la position de chaque quille
    v2 = q[n].position;
    //si la boule touche une quille
    if(v1.distanceTo(v2) < 0.9/14 + R && q[n].visible == true)
    {      
      //on marque un point
      nbPoints++;
      //calcul des distances pour savoir quelles quilles vont être entraîné par la chute de la quille
      dG = v2.distanceTo(gauche);
      dM = v2.distanceTo(milieu);
      dD = v2.distanceTo(droite);

      //élément aléatoire
      let alea = Math.random();

      //si l'impact est au centre
      if(dM < dG && dM < dD)
      {
        //récupération des quilles voisines à celle touchée
        Q = quillesVoisine(n,1);
        //enchainement de chute des quilles
        for(i=0;i<Q.length;i++)
        {
          //alea sert à éviter que toutes les quilles tombent en donnant une probabilité
          //de tomber chacune à plus elle sont loin de la quille touché
          if(alea <= 0.8 && q[Q[i]-1].visible == true){
            q[Q[i]-1].visible = false;
            nbPoints++; //le score augmente à chaque nouvelle quille qui tombe
            alea+=0.1; //diminution de la probabilité
          }
        }
      }
      else
      //si l'impact est sur la gauche de la boule
        if(dG < dD)
        {
          Q = quillesVoisine(n,2);
          for(i=0;i<Q.length;i++)
          {
            if(alea <= 0.8 && q[Q[i]-1].visible == true){
              q[Q[i]-1].visible = false;
              nbPoints++;
              alea+=0.1;          
            }
          }
        }
        else
        {//si l'impact est sur la droite de la boule
          Q = quillesVoisine(n,3);
          for(i=0;i<Q.length;i++)
          {
            if(alea <= 0.8 && q[Q[i]-1].visible == true){
              q[Q[i]-1].visible = false;
              nbPoints++;
              alea+=0.1;
            }
          }
        }
      //la quille touchée disparait
      q[n].visible = false;
      q[n].position.set(v2);
    }
  }
  return nbPoints;
  }

  //traite une mène d'équipe et arrête le jeu quand 4 mènes ont été joué
  function jeu(){
    let couleurCourante = boule.children[0].material.color;
    if(nbTire == 1 && nbPoints == 10)
    {
      //strike alors ajout des points => changement de couleur de la boule => reset des quilles
      alert("Strike ! ");
      if(couleurCourante.getHex()==0x003cff)
      {
        document.forms["score"].scoreBleu.value=(totalBleu+30);
        totalBleu += 30;
        if(boule) scene.remove(boule);
        boule = creerBoule(rouge);
        scene.add(boule);
      }
      else
      {
        document.forms["score"].scoreRouge.value=(totalRouge+30);
        totalRouge += 30;
        if(boule) scene.remove(boule);
        boule = creerBoule(bleu);
        scene.add(boule);
      }
        reset();
        nbTireTotal+=2;
    }
    else
    {
      if(nbTire == 2 && nbPoints == 10)
      {
        //spare si lancé 2 fait tomber toutes quilles restantes
        alert("Spare ! ");
        if(couleurCourante.getHex()==0x003cff)
      {
        document.forms["score"].scoreBleu.value=(totalBleu+15);
        totalBleu += 15;
        if(boule) scene.remove(boule);
        boule = creerBoule(rouge);
        scene.add(boule);
      }
      else
      {
        document.forms["score"].scoreRouge.value=(totalRouge+15);
        totalRouge += 15;
        if(boule) scene.remove(boule);
        boule = creerBoule(bleu);
        scene.add(boule);
      }
        reset();
      }
      else
      {
        if(nbTire == 2)
        {
          //1 point par quille donc lancé 1 ou/et 2 "raté" 
        if(couleurCourante.getHex()==0x003cff)
        {
          document.forms["score"].scoreBleu.value=(totalBleu+nbPoints);
          totalBleu += nbPoints;
          if(boule) scene.remove(boule);
          boule = creerBoule(rouge);
          scene.add(boule);
        }
        else
        {
          document.forms["score"].scoreRouge.value=(totalRouge+nbPoints);
          totalRouge += nbPoints;
          if(boule) scene.remove(boule);
          boule = creerBoule(bleu);
          scene.add(boule);
        }
          reset();
        }
      }
      nbTireTotal++;
    }
    finDuJeu();
  }

  //si tous les 2 mènes par équipe ont été effectués, annonce le gagnant
  function finDuJeu(){
    if(nbTireTotal >= 8){
      if(totalBleu == totalRouge)
        alert("Egalité !");
      if(totalBleu > totalRouge)
        alert("L'équipe Bleu a gagné ! ");
      if(totalRouge > totalBleu)
        alert("L'équipe Rouge a gagné ! ");
    }
  }

  //replace les quilles et réinitialise les compteurs de points et de tires pour la prochaine mène
  function reset(){
    nbTire = 0;
    nbPoints = 0;
    if(quilles) scene.remove(quilles);
    quilles = placerQuille();
    scene.add(quilles);
  }

  //efface toutes les courbes/droites/points d'aide à la trajectoire
  function supprAides(){
    if(courbe1) scene.remove(courbe1);
    if(courbe2) scene.remove(courbe2);
    if(ligne) scene.remove(ligne);
    if(pt1) scene.remove(pt1);
    if(pt2) scene.remove(pt2);
    if(pt3) scene.remove(pt3);
  }

  //affiche les points de la jointure G1 sur la piste
  function dessinerPoint(x0,y0,x1,y1,x2,y2){
    P0 = new THREE.Vector3( x0, y0, R);
    P1 = new THREE.Vector3( x1, y1, R);
    P2 = new THREE.Vector3( x2, y2, R);

    if(pt1) scene.remove(pt1);
    pt1=tracePt(scene, P0, "#000088",0.1,true);
    if(pt2) scene.remove(pt2);
    pt2=tracePt(scene, P1, "#000088",0.1,true);
    if(pt3) scene.remove(pt3);
    pt3=tracePt(scene, P2, "#000088",0.1,true);
  }

  // definition des fonctions idoines
 function posCamera(){
  camera.position.set(menuGUI.cameraxPos*testZero(menuGUI.cameraZoom),menuGUI.camerayPos*testZero(menuGUI.cameraZoom),menuGUI.camerazPos*testZero(menuGUI.cameraZoom));
  camera.lookAt(menuGUI.cameraxDir,menuGUI.camerayDir,menuGUI.camerazDir);
  //actuaPosCameraHTML();
 }
 
  // ajoute le rendu dans l'element HTML
 document.getElementById("webgl").appendChild(rendu.domElement);
   
  // affichage de la scene
 rendu.render(scene, camera);
  
 
 function reAffichage() {
  setTimeout(function () {
   posCamera();
  }, 200);// fin setTimeout(function ()
    // rendu avec requestAnimationFrame
  rendu.render(scene, camera);
 }// fin fonction reAffichage()
 
 
  function renduAnim() {
    stats.update();
    // rendu avec requestAnimationFrame
    requestAnimationFrame(renduAnim);
// ajoute le rendu dans l'element HTML
    rendu.render(scene, camera);
  }
  
 
} // fin fonction init()
//**************************************************************************




//**************************************************************************
//DEBUT FONCTIONS UTILES

//trace une courbe de Bézier à 3 points 
//renvoie l'objet courbe et le tableau de point qui la compose
function dessinerCourbe(x0,y0,x1,y1,x2,y2,nbPoints){
  P0 = new THREE.Vector3( x0, y0, R);
  P1 = new THREE.Vector3( x1, y1, R);
  P2 = new THREE.Vector3( x2, y2, R);

  let courbe = new THREE.QuadraticBezierCurve3( P0, P1, P2 );
  let points = courbe.getPoints( nbPoints );
  let courbeGeo = new THREE.BufferGeometry().setFromPoints(points);
  let material = new THREE.LineBasicMaterial({ color : "#000000" });
  let objetCourbe = new THREE.Line( courbeGeo, material);

  return [objetCourbe,points];
}//fin dessinerCourbe


//permet de calculer une équation de droite à partir de 2 points
function droite(A,B){
  let a = ((B.y-A.y) / (B.x-A.x));
  let b = (A.y) - a*(A.x);
  return [a,b];
}//fin droite

//dessine une ligne (lancer rectiligne)
function dessinerLigne(departY,arriveeY){
  let points = [];
  points.push(new THREE.Vector3( -10 , departY , R ));
  points.push(new THREE.Vector3( distanceMaxTrajet , arriveeY , R ));

  let ligneGeo = new THREE.BufferGeometry().setFromPoints(points);
  let ligne = new THREE.Line(ligneGeo,new THREE.LineBasicMaterial({ color: "#000000"}));

  return ligne;
}//fin dessinerLigne

//construit la boule avec une courbe à l'intérieur et une couleur en paramètre
function creerBoule(coulEquip){
  let boule = null;
  let bouleGeometry = new THREE.SphereGeometry(R,32,16);
  let bouleSurf = surfPhong(bouleGeometry,coulEquip,1,false,"#ffead4");
  boule = new THREE.Group();
  boule.add(bouleSurf);

  //construit une courbe dans la sphère
  let nb = 40;
  let a = 0.75 * R; 
  let b = R-a;
  let points = new Array(nb+1);
    for(var k=0;k<=nb;k++){
      let t2=k/nb*2*Math.PI; 
      t2=t2.toPrecision(PrecisionArrondi);
      let x0,y0,z0;
      with(Math){
        x0=a*cos(t2)+b*cos(3.*t2);
        y0=a*sin(t2)-b*sin(3.*t2);
        z0=2.*sqrt(a*b)*sin(2.*t2);
      }
      points[k] = new THREE.Vector3(x0,y0,z0);
  }    
  let PtsCbePara = new THREE.BufferGeometry().setFromPoints(points);

  //couleur de la ligne
  if(coulEquip == bleu)
      var coulAdver = rouge;
  else
      var coulAdver = bleu;
  
  let courbeMateriel = new THREE.LineBasicMaterial( { color:coulAdver,linewidth:3 } );
  let courbe = new THREE.Line(PtsCbePara,courbeMateriel);

  boule.add(courbe);

  boule.position.set(-10,0,R);

  return boule;
  
}//fin creerBoule


//permet de placer toutes les quilles sur la piste et les stocker dans un groupe de quilles
function placerQuille(){
  quille1 = creerQuille();
  quille1.position.set(9.208,0,0);
  quille1.name = "quille1";
  quille2 = creerQuille();
  quille2.position.set(9.471,-0.1425,0);
  quille2.name = "quille2";
  quille3 = creerQuille();
  quille3.position.set(9.471,0.1425,0);
  quille3.name = "quille3";
  quille4 = creerQuille();
  quille4.position.set(9.6975,-0.2945,0);
  quille4.name = "quille4";
  quille5 = creerQuille();
  quille5.position.set(9.6975,0,0);
  quille5.name = "quille5";
  quille6 = creerQuille();
  quille6.position.set(9.6975,0.2945,0);
  quille6.name = "quille6";
  quille7 = creerQuille();
  quille7.position.set(9.924,-0.4365,0);
  quille7.name = "quille7";
  quille8 = creerQuille();
  quille8.position.set(9.924,-0.1425,0);
  quille8.name = "quille8";
  quille9 = creerQuille();
  quille9.position.set(9.924,0.1425,0);
  quille9.name = "quille9";
  quille10 = creerQuille();
  quille10.position.set(9.924,0.4365,0);
  quille10.name = "quille10";

  quilles = new THREE.Group();
  quilles.add(quille1);
  quilles.add(quille2);
  quilles.add(quille3);
  quilles.add(quille4);
  quilles.add(quille5);
  quilles.add(quille6);
  quilles.add(quille7);
  quilles.add(quille8);
  quilles.add(quille9);
  quilles.add(quille10);

  return quilles;
}//fin placerQuille

//construit 3 lathes et les regroupe pour créer une quille
function creerQuille(){
  let P0 = new THREE.Vector2(0.57,0);
  let P1 = new THREE.Vector2(0.9,0.3);
  let P2 = new THREE.Vector2(0.9,0.5);
  let P3 = new THREE.Vector2(0.9,1.143);

  let M0 = P3;  //jointure G1 car P2,P3/M0,M1 sont alignés
  let M1 = new THREE.Vector2(0.9,1.5);
  let M2 = new THREE.Vector2(0.9,1.9);
  let M3 = new THREE.Vector2(0.6,2.3);

  let N0 = M3;  //jointure G1 car M2,M3/N0,N1 sont alignés
  let N1 = new THREE.Vector2(0,3.1);
  let N2 = new THREE.Vector2(1,4.1);
  let N3 = new THREE.Vector2(0,4.2);
  
  //création de 3 lathes
  let baseQuille = latheBez3(50,150,P0,P1,P2,P3,"#e8e8e8",1,false);
  let milieuQuille = latheBez3(50,150,M0,M1,M2,M3,"#d9291c",1,false);
  let hautQuille = latheBez3(50,150,N0,N1,N2,N3,"#e8e8e8",1,false);

  baseQuille.rotateX(Math.PI/2);
  milieuQuille.rotateX(Math.PI/2);
  hautQuille.rotateX(Math.PI/2);

  let quille = new THREE.Group();
  quille.add(baseQuille);
  quille.add(milieuQuille);
  quille.add(hautQuille);

  quille.scale.set(1/14,1/14,1/14);

  return quille;
}//fin creerQuille

//construit un objet piste et 2 objets gouttières 
function creerPiste(){
  let pisteGeometry = new THREE.PlaneGeometry(20,1);
  let piste = surfPhong(pisteGeometry,"#ffa44f",1,false,"#ffead4");

  let gouttiereGeometry = new THREE.CylinderGeometry(0.235/2,0.235/2,20,20,1,false,0,Math.PI);
  let gouttiere1 = surfPhong(gouttiereGeometry,"#2e1906",1,false,"#ffead4");
  gouttiere1.rotateY(Math.PI/2);
  gouttiere1.rotateX(Math.PI/2);
  gouttiere2 = gouttiere1.clone();
  gouttiere1.position.y=0.5 + 0.235/2;
  gouttiere2.position.y=-0.5 - 0.235/2;

  let pisteGouttieres = new THREE.Group();
  pisteGouttieres.add(piste);
  pisteGouttieres.add(gouttiere1);
  pisteGouttieres.add(gouttiere2);

  return pisteGouttieres;
}//fin creerPiste

//construit une lathe à partir d'une courbe de Bezier à 4 points
function latheBez3(nbePtCbe,nbePtRot,P0,P1,P2,P3,coul,opacite,bolTranspa){
  let p0= new THREE.Vector2(P0.x,P0.y);
  let p1= new THREE.Vector2(P1.x,P1.y);
  let p2= new THREE.Vector2(P2.x,P2.y);
  let p3= new THREE.Vector2(P3.x,P3.y);
  let Cbe3 = new THREE.CubicBezierCurve(p0,p1,p2,p3);
  let points = Cbe3.getPoints(nbePtCbe);
  let latheGeometry = new THREE.LatheGeometry(points,nbePtRot,0,2*Math.PI);
  let lathe = surfPhong(latheGeometry,coul,opacite,bolTranspa,"#ffead4");
  return lathe;
 }// fin latheBez3




//dessine un point
 function tracePt(MaScene, P, CoulHexa,dimPt,bol){    
  let sphereGeometry = new THREE.SphereGeometry(dimPt,12,24);
  let  sphereMaterial = new THREE.MeshBasicMaterial({color: CoulHexa });
  let sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.position.set(P.x,P.y,P.z);
  if (bol) MaScene.add(sphere);
  return sphere;
 } // fin function tracePt




//FIN FONCTIONS UTILES
//**************************************************************************


