export class UI{
    constructor(game){
        this.messages = { 
			text:[ 
			
			],
			index:0
		}

        this.store = game.store;

		this.init();

	}

	init(){
		if (localStorage){
			const json = localStorage.getItem( 'rollOn' );

			console.log(`ui.init ${json}`);

			if ( json ){
				const data = JSON.parse( json );
				this.store.levelIndex = data.levelIndex;
				this.store.score = data.score;
				this.store.balls = data.balls;

				if (data.balls<0){
					this.store.levelIndex = 1;
					this.store.score = 0;
					this.store.balls = 5;
				}

				if (data.levelIndex>50){
					this.store.levelIndex = 3;
				}
			}
		}

		this.level = this.store.levelIndex;
		this.bonus = this.store.score;
		this.balls = this.store.balls;
    }

    startMessages(){
		
	}

	save(){
		if (localStorage){
			localStorage.setItem( 'rollOn', JSON.stringify( this.store ) );
		}
	}

    set level( value ){
		this.store.levelIndex = value;
		this.save();
        const txt = document.getElementById("level");
		txt.innerHTML = `Level: ${value}`;
    }

	get level( ){
		return this.store.levelIndex;
	}

	incBonus( value ){
		this.bonus += value;
	}

    set bonus( value ){
		this.store.score = value;
		this.save();
        const txt = document.getElementById("bonus");
		let str = String( value );
		while( str.length<5 ) str = `0${str}`;
		txt.innerHTML = `Score: ${str}`;
    }

	get bonus(){
		return this.store.score;
	}

    set balls( value ){
		this.store.balls = value;
		this.save();
        const txt = document.getElementById("balls");
		txt.innerHTML = `Balls: ${value}`;
    }

	get balls(){
		return this.store.balls;
	}

    showMessage(msg, fontSize=20, onOK=null, binder=null){
		const txt = document.getElementById('message_text');
		txt.innerHTML = msg;
		txt.style.fontSize = fontSize + 'px';
		const btn = document.getElementById('message_ok');
		const panel = document.getElementById('message');
	
		if (onOK!=null){
			btn.onclick = ()=>{ 
				panel.style.display = 'none';
				onOK.call((binder) ? binder : this); 
			}
		}else{
			btn.onclick = function(){
				panel.style.display = 'none';
			}
		}

		panel.style.display = 'flex';
	}

    buyHints(){

    }

}