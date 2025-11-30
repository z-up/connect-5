import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


export class App {
	constructor(){
		const container = document.createElement( 'div' );
		document.body.appendChild(container);

		this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
		this.camera.position.set(0, 0, 8);

		this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x656585);

		const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.3);
		this.scene.add(ambient);

        const light = new THREE.DirectionalLight(0xFFFFFF, 3);
        light.position.set(0.2, 1, 1);
        this.scene.add(light);

		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		container.appendChild(this.renderer.domElement);

        const geometry = new THREE.SphereGeometry(0.15);

		this.vacantBallMaterial = new THREE.MeshStandardMaterial({
			transparent: true,
			opacity: 0.2,
			color: 0x00FF00,
			emissive: 0x00FF00,
			emissiveIntensity: 1
		});

		this.balls = [];

		for(let x = 0; x <= 4; x +=1 ) {
			let layer = [];
			for(let y = 0; y <= 4; y += 1){
				let line = [];
				for(let z = 0; z <= 4; z += 1){
					let mesh = new THREE.Mesh(geometry, this.vacantBallMaterial);
					mesh.position.set(x - 2, y - 2, z - 2);
					if(y !== 0) {
						mesh.scale.set(0, 0, 0);
					}

					this.scene.add(mesh);

					let state = y == 0 ? BallState.Vacant : BallState.Invisible;
					let ball = new Ball(state, mesh, [x, y, z], y === 0);
					mesh.ball = ball;
					line.push(ball);
				}
				layer.push(line);
			}
			this.balls.push(layer);
		}


        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		// When damping is enabled you neeed to call controls.updated() on each frame
		this.controls.enableDamping = true;

        this.renderer.setAnimationLoop(this.render.bind(this));

		this.raycaster = new THREE.Raycaster();
		this.raycastHit = null;

        window.addEventListener('resize', this.resize.bind(this));

		// prevent click event after rotating the scene
		this.mousePressed = false;
		this.dragging = false;

		window.addEventListener('mousedown', () => {
			this.mousePressed = true;
		});

    	window.addEventListener('mousemove', () => {
			this.dragging = this.mousePressed;
		});

    	window.addEventListener('mouseup', (event) => {
			this.mousePressed = false;
			if (!this.dragging) {
				this.click(event);
			}
		});

		this.state = GameState.NotStarted;
	}

	resetGame() {
		this.state = GameState.NotStarted;
		for(let x = 0; x <= 4; x += 1){
			for(let y = 0; y <= 4; y += 1){
				for(let z = 0; z <= 4; z += 1){
					const ball = this.balls[x][y][z];
					if(y === 0){
						ball.state = BallState.Vacant;
						ball.clickable = true;
						ball.mesh.material = this.vacantBallMaterial;
						ball.mesh.scale.set(1, 1, 1);
					}
					else {
						ball.state = BallState.Invisible;
						ball.clickable = false;
						ball.mesh.material = this.vacantBallMaterial;
						ball.mesh.scale.set(0, 0, 0);
					}
				}
			}
		}
	}

	setPlayerColor(color) {
		if(color === "red"){
			this.opponentsMaterial = new THREE.MeshStandardMaterial( { color: 0xFF0000 });
			this.myMaterial = new THREE.MeshStandardMaterial( { color: 0xFFFF00 });
			this.state = GameState.WaitingForOpponent;
		}
		else{
			this.opponentsMaterial = new THREE.MeshStandardMaterial( { color: 0xFFFF00 });
			this.myMaterial = new THREE.MeshStandardMaterial( { color: 0xFF0000 });
			this.state = GameState.MakingMyMove;
			setTimeout(this.makeAMove.bind(this), 700);
		}
	}


	click(event){
		if(this.state !== GameState.WaitingForOpponent){
			return;
		}

		const mousePos = new THREE.Vector2(
			(event.clientX / window.innerWidth) * 2 - 1,
			-((event.clientY / window.innerHeight) * 2 - 1)
		);

		this.raycaster.setFromCamera(mousePos, this.camera);
		const clickableBalls = this.getClickableBalls();
		const hits = this.raycaster.intersectObjects(clickableBalls);

		if(hits.length === 0){
			return;
		}
		const ballMesh = hits[0].object;
		this.onBallClick(ballMesh.ball);

		if(this.gameIsWon(BallState.Opponents)){
			this.state = GameState.Finished;
			setTimeout(() => showInfoDlg("You won 👍"), 500);
			return;
		}

		this.state = GameState.MakingMyMove;
		setTimeout(this.makeAMove.bind(this), 700);
	}


	getVacantBallMeshes(){
		const vacant = [];
		for(let x = 0; x <= 4; x += 1){
			for(let y = 0; y <= 4; y += 1){
				for(let z = 0; z <= 4; z += 1){
					const ball = this.balls[x][y][z];
					if(ball.state === BallState.Vacant){
						vacant.push(ball.mesh);
					}
				}
			}
		}
		return vacant;
	}

	getClickableBalls(){
		const clickable = [];
		for(let x = 0; x <= 4; x += 1){
			for(let y = 0; y <= 4; y += 1){
				for(let z = 0; z <= 4; z += 1){
					const ball = this.balls[x][y][z];
					if(ball.clickable){
						clickable.push(ball.mesh);
					}
				}
			}
		}
		return clickable;

	}

	makeAMove() {
		// check corners of the bottom layer
		const cornerIndices = [[0, 0], [0, 4], [4, 0], [4, 4]];
		for(let [x, z] of cornerIndices){
			const ball = this.balls[x][0][z];
			if(ball.state === BallState.Vacant){
				this.setBallState(ball, BallState.Mine);
				this.state = GameState.WaitingForOpponent;
				return;
			}
		}

		// check if I have 4 balls in a row
		for(let l of this.getAllPossibleLines()){
			if(l.filter(b => b.state === BallState.Mine).length === 4){
				let vacant = l.filter(b => b.state === BallState.Vacant);
				if(vacant.length !== 0){
					this.setBallState(vacant[0], BallState.Mine);
					this.state = GameState.Finished;
					this.highlightLine(l);
					// alert("You lost!"); // is shown bebore the ball color is changed
					setTimeout(() => showInfoDlg("You lost 😛"), 500);
					return;
				}
			}
		}

		// check if opponent has 4 balls in a row
		for(let l of this.getAllPossibleLines()){
			if(l.filter(b => b.state === BallState.Opponents).length === 4){
				let vacant = l.filter(b => b.state === BallState.Vacant);
				if(vacant.length !== 0){
					this.setBallState(vacant[0], BallState.Mine);
					this.state = GameState.WaitingForOpponent;
					return;
				}
			}
		}

		// find the row with no opponent balls and a max number of my balls
		let possibleLines = []
		for(let l of this.getAllPossibleLines()){
			if(l.filter(b => b.state === BallState.Opponents).length === 0
				&& l.filter(b => b.state === BallState.Mine).length > 0
				&& l.filter(b => b.state === BallState.Vacant).length > 0
			) {
				possibleLines.push(l);
			}
		}

		if(possibleLines.length !== 0){
			const countMyBalls = l => l.filter(b => b.state == BallState.Mine).length;
			possibleLines.sort((l1, l2) => countMyBalls(l2) - countMyBalls(l1));
			let bestLine = possibleLines[0];
			this.setBallState(bestLine.filter(b => b.state == BallState.Vacant)[0], BallState.Mine);
			this.state = GameState.WaitingForOpponent;
			return;
		}

		//
		const vacant = this.getVacantBallMeshes();
		if(vacant.length !== 0){
			this.setBallState(vacant[0].ball, BallState.Mine);
			this.state = GameState.WaitingForOpponent;
		}
		else{
			//alert("There are no more moves");
			showInfoDlg("There are no more moves");
			this.state = GameState.Finished;
			return;
		}
	}

	gameIsWon(state){
		let counter = 0;
		for(let l of this.getAllPossibleLines()){
			counter += 1;
			if(l.every(b => b.state === state)){
				this.highlightLine(l);
				return true;
			}
		}
		return false;
	}

	onBallClick(ball){
		if(ball.state === BallState.Vacant){ // click on a geen placeHolder
			this.setBallState(ball, BallState.Opponents);
		}
		else { // click on already placed ball
			const [x, y, z] = ball.indices;
			const ballAbove = this.balls[x][y + 1][z];
			this.setBallState(ballAbove, BallState.Opponents);
		}
	}


	setBallState(ball, state){
		ball.state = state;
		ball.mesh.material = state === BallState.Mine ? this.myMaterial : this.opponentsMaterial;
		ball.mesh.scale.set(1, 1, 1);

		const [x, y, z] = ball.indices;
		if(y !== 4){
			ball.clickable = true;
			const ballAbove = this.balls[x][y + 1][z];
			ballAbove.state = BallState.Vacant;
		}
		if(y !== 0){
			const ballBelow = this.balls[x][y - 1][z];
			ballBelow.clickable = false;
		}
	}


	* getAllPossibleLines(){
		// horizontal lines
		for(let y = 0; y <= 4; y += 1){
			for(let x = 0; x <= 4; x += 1){
				const line = [];
				for(let z = 0; z <= 4; z += 1){
					line.push(this.balls[x][y][z]);
				}
				yield line;
			}

			for(let z = 0; z <= 4; z += 1){
				const line = [];
				for(let x = 0; x <= 4; x += 1){
					line.push(this.balls[x][y][z]);
				}
				yield line;
			}

			// diagonals
			let line = [];
			for(let x = 0, z = 0; x <= 4, z <= 4; x += 1, z += 1){
				line.push(this.balls[x][y][z]);
			}
			yield line;

			line = [];
			for(let x = 0, z = 4; x <= 4, z >= 0; x += 1, z -= 1){
				line.push(this.balls[x][y][z]);
			}
			yield line;

		}

		// vertical lines
		for(let z = 0; z <= 4; z += 1){
			for(let x = 0; x <= 4; x += 1){
				const line = [];
				for(let y = 0; y <= 4; y += 1){
					line.push(this.balls[x][y][z]);
				}
				yield line;
			}
		}

		// diagonals parallel to one of the sides
		for(let x = 0; x <= 4; x += 1){
			let line = [];
			for(let y = 0, z = 0; y <= 4, z <= 4; y +=1, z += 1){
				line.push(this.balls[x][y][z]);
			}
			yield line;

			line = [];
			for(let y = 0, z = 4; y <= 4, z >= 0; y +=1, z -= 1){
				line.push(this.balls[x][y][z]);
			}
			yield line;
		}

		for(let z = 0; z <= 4; z += 1){
			let line = [];
			for(let y = 0, x = 0; y <= 4, x <= 4; y +=1, x += 1){
				line.push(this.balls[x][y][z]);
			}
			yield line;

			line = [];
			for(let y = 0, x = 4; y <= 4, x >= 0; y +=1, x -= 1){
				line.push(this.balls[x][y][z]);
			}
			yield line;
		}

		let line = [];
		for(let x = 0, y = 0, z = 0; x <= 4, y <= 4, z <= 4; x += 1, y += 1, z += 1){
			line.push(this.balls[x][y][z]);
		}
		yield line;

		line = [];
		for(let x = 0, y = 4, z = 0; x <= 4, y >= 0, z <= 4; x += 1, y -= 1, z += 1){
			line.push(this.balls[x][y][z]);
		}
		yield line;

		line = [];
		for(let x = 0, y = 0, z = 4; x <= 4, y <= 4, z >= 0; x += 1, y += 1, z -= 1){
			line.push(this.balls[x][y][z]);
		}
		yield line;

		line = [];
		for(let x = 0, y = 4, z = 4; x <= 4, y >= 0, z >= 0; x += 1, y -= 1, z -= 1){
			line.push(this.balls[x][y][z]);
		}
		yield line;
	}

	highlightLine(line){
		for(let b of line){
			b.mesh.scale.set(1.6, 1.6, 1.6);
		}
	}

	render(){
		this.controls.update();
        this.renderer.render( this.scene, this.camera );
    }

    resize(){
		this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );

		// in case the window is moved to another screen
    	// with a different pixel ratio
    	this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
}

const GameState = Object.freeze({
	NotStarted: 0,
    WaitingForOpponent: 1,
	MakingMyMove: 2,
    AnimationInProgress: 3,
	Finished: 4
});


class Ball {
	constructor(state, mesh, indices, clickable) {
		this.state = state;
		this.mesh = mesh;
		this.indices = indices;
		this.clickable = clickable;
	}
}

const BallState = Object.freeze({
    Invisible: 0,
    Vacant: 1,
    Mine: 2,
    Opponents: 3
});



function showInfoDlg(info){
	document.getElementById("info_dlg_content").innerHTML = info;
	document.getElementById("info_dlg").showModal();
}
