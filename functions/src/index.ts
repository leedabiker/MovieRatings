import * as functions from 'firebase-functions';
const {WebhookClient, Card, Suggestion} = require('dialogflow-fulfillment');
const rpn = require('request-promise-native');

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

const API_KEY = 'c17c035e';
const API_URI = 'http://www.omdbapi.com';
const API_HEAD = {'User-Agent': 'Request-Promise'};
const IS_ERROR = 'isError';

interface MovieObject {
	imdbRating:string;
	imdbVotes:string;
}



export const getMovieRating = functions.https.onRequest((request, response) => {
		
	const agent1 = new WebhookClient({ request, response });

	async function getRating(agent){
		const mName = agent.parameters.movie_title;
		console.log("getRating: movie name is " + mName);

		let data:MovieObject;

		// if theres a year in the request then search and find
		if(agent.parameters.release_year.length === 0){
			//otherwise just get the nearest match based on title
			data = await getByName(agent);
		}else{
			// search all titles with that name
			const objTitles = await searchTitles(agent);

			// look at results, find the one with the neareset year. 
			const imdbID = getNearestByYear(agent, objTitles);
			// Use the IMDB title ID to lookup on the API
			data = await getByImdbID(agent, imdbID);
			
		}


		try{
			console.log("getRating: rating is " + data.imdbRating );
		}catch(e){
			console.error("getRating: failed to parse JSON - data.imdbRating. Message:" + e);
			agent.add(`I'm sorry, there was a problem. Please try again later`);
			return;
		}
		//TODO: return found title name and use it here
		agent.add(`The rating for `+mName+` is `+ JSON.stringify(data.imdbRating) + 
            `. This is based on ` +JSON.stringify(data.imdbVotes)+ ` votes`);

	}


	function searchTitles(agent){
		// search by given title
		const mName = agent.parameters.movie_title;
		
		const options = {
			uri: API_URI,
			qs:{s:mName, apiKey:API_KEY},
			headers:API_HEAD,
			json: true
		}

		return rpn(options) 
			.then(d => {return d} );

	}


	function getNearestByYear(agent, jsonTitles){
		// parse results and find the exact title matches
		// TODO: what if there are similar titles but no exact?
		console.log("getNearestByYear():: titles data:" + jsonTitles);

		console.log("count of titles:" + JSON.stringify(jsonTitles.Search.length));
		console.log("all years is: " + JSON.stringify(jsonTitles.Search[0].Year));

		
		const paramYear = parseInt(agent.parameters.release_year);
		let currentClosest_year = 1; // holds the current closes year		
		let currentClosest_title = ""; // holds the title with the closest year
		let currentClosest_id = ""; // holds the imdb Id of the title with the closest year
		for(let i in jsonTitles.Search) {
			let type = jsonTitles.Search[i].Type;
			let year = parseInt(jsonTitles.Search[i].Year);
			let title = jsonTitles.Search[i].Title;
			let id = jsonTitles.Search[i].imdbID;
			if(type == "movie" && !isNaN(year)){
				console.log(jsonTitles.Search[i].Year +" "+jsonTitles.Search[i].Title + " " + jsonTitles.Search[i].Type  );
				/* check if this data is closer than the last.  */
				console.log(Math.abs(year - paramYear) +" ::: "+ Math.abs(year - currentClosest_year) )
				if(Math.abs(year - paramYear) < Math.abs(year - currentClosest_year)) {
					currentClosest_title = title;
					currentClosest_year = year;
					currentClosest_id = id;
				}
			}
		}
		console.log("neareset is: " + currentClosest_year);
		console.log("neareset is: " + currentClosest_title);
		console.log("neareset is: " + currentClosest_id);

		agent.add('looking up ' + currentClosest_title);
		// find the results that have the closest date
		
		return currentClosest_id;
	}

	function getByImdbID(agent, id){
			

		const options = {
			uri: API_URI,
			qs:{i:id, apiKey:API_KEY},
			headers:API_HEAD,
			json: true
		}

		return rpn(options) //have to use 'then' - adding async to the function causes type check error with tslint 
			.then(d => {return d} );
	}

	function getByName(agent){
		const mName = agent.parameters.movie_title;
		agent.add(`looking up ` + mName);

		const options = {
			uri: API_URI,
			qs:{t:mName, apiKey:API_KEY},
			headers:API_HEAD,
			json: true
		}

		return rpn(options) //have to use 'then' - adding async to the function causes type check error with tslint 
			.then(d => {return d} );
		//console.log('getMovieRating::getByName: resp:' + JSON.stringify(resp));
		//return await Promise.resolve(resp);

	}

	// Run the proper function handler based on the matched Dialogflow intent name
	const intentMap = new Map();
	intentMap.set('Get Rating', getRating);
	// intentMap.set('your intent name here', googleAssistantHandler);
	agent1.handleRequest(intentMap);
});
