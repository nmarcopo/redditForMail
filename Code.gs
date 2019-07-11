/**
* Returns the array of cards that should be rendered for the current
* subreddit. This list is cached for 25 minutes, and afterward the list
* is refreshed.
*
* @return {Card[]}: list of cards that represent posts
*/
function buildAddOn() {
  var sections = [];
  
  var redditArray = loadRedditData();
  
  // iterate through all of the requested posts
  for(var i = 0; i < redditArray.length; i++){
    var post = redditArray[i].data;
    
    // Set title section
    var titleSection = CardService.newKeyValue()
    .setTopLabel("Post Title:")
    .setContent(post.title)
    .setMultiline(true);
    
    // Set body section
    var selftextSection = CardService.newKeyValue()
    .setTopLabel("Post Body:")
    .setMultiline(true);
    if(post.selftext !== ""){
      selftextSection
      .setContent(post.selftext)
    }else{
      selftextSection
      .setContent("No body.");
    }
    
    // Set image preview
    var imageSection;
    if(post.domain === "i.redd.it" || (post.domain === "i.imgur.com" && post.url.indexOf(".gifv") === -1)){
      imageSection = CardService.newImage();
      imageSection.setImageUrl(post.url);
      var imageAction = CardService.newAction()
      .setFunctionName("openURLAction")
      .setParameters({url: post.url});
      imageSection.setOnClickOpenLinkAction(imageAction)
    }else{
      imageSection = CardService.newKeyValue()
      imageSection
      .setTopLabel("Post Image:")
      .setContent("No Image Available.")
    }
    
    // Set source link
    var sourceAction = CardService.newAction()
    .setFunctionName("openURLAction")
    .setParameters({url: "https://reddit.com" + post.permalink})
    var sourceSection = CardService.newTextButton().setText("View source on Reddit").setOnClickOpenLinkAction(sourceAction)
    
    // Set score formatting
    var scoreNumber = post.score;
    if(scoreNumber > 999){
      scoreNumber = Math.floor(scoreNumber / 1000) + "K";
    }
    
    // Set header, title, and subtitle
    var cardHeader = CardService.newCardHeader()
    .setTitle(post.title)
    .setSubtitle(scoreNumber + " points, /r/" + post.subreddit);
    if(post.thumbnail.indexOf("https") > -1){
      cardHeader
      .setImageUrl(post.thumbnail)
      .setImageAltText(post.title);
    }
    
    // Put all of the above together in the card
    var card = CardService.newCardBuilder()
    .setHeader(cardHeader)
    .addSection(CardService.newCardSection().addWidget(sourceSection))
    .addSection(CardService.newCardSection().addWidget(titleSection))
    .addSection(CardService.newCardSection().addWidget(imageSection))
    .addSection(CardService.newCardSection().addWidget(selftextSection))
    .build();
    
    // Add card to list of cards that will be displayed to user
    sections.push(card)
  }
  
  // Return and display the cards to the user
  return sections;
}

/**
* This function allows the add-on to open links to source reddit pages and images.
*
* @return {Action}: opens a link specified in params.parameters.url
*/
function openURLAction(params){
  return CardService.newActionResponseBuilder()
  .setOpenLink(CardService.newOpenLink()
               .setUrl(params.parameters.url))
  .build();
}

/**
* This function loads Reddit data from the desired subreddit JSON and places it in the cache.
* If there is already data in the cache, the function loads that data instead.
* 
* @return {JSON Object}: object of 'hot' reddit posts for the subreddit
*/
function loadRedditData(){
  // First, check cache for the data
  var cache = CacheService.getUserCache();
  var cached = cache.get("redditData");
  if (cached != null) {
    // Return parsed JSON of the cached data
    return JSON.parse(cached);
  }
  
  // If there's no cache, load the specified subreddit data
  var subreddit = PropertiesService.getUserProperties().getProperty("subreddit");
  if(subreddit == null){
    subreddit = "/r/popular";
  }
  var response = UrlFetchApp.fetch("https://www.reddit.com" + subreddit + ".json");
  var jsonData = JSON.parse(response.getContentText());
  var redditArray = jsonData.data.children;
  
  // Try to get 26 posts in the cache, this may fail since the JSON object can be large
  // If we fail on 26, try 25, then 24, etc.
  var cached = false;
  var numPosts = 25; // actually 26 including the 0th element
  while(!cached){
    try{
      var smallerArray = redditArray.slice(0,numPosts);
      cache.put("redditData", JSON.stringify(smallerArray), 1500); // cache for 25 minutes
      cached = true;
    }catch(err){
      numPosts--;
    }
  }
  
  // Return the JSON object of the reddit data
  return smallerArray;
}

/**
* This is the function that gets called from the "Choose Subreddit" universal action.
* The subreddit is loaded into the UserProperties.
*
* return {Card[]}: card that shows the "Choose Subreddit" view
*/
function chooseSubreddit(){
  var cards = []
  
  // Check what the existing subreddit choice is
  var currentSubreddit = PropertiesService.getUserProperties().getProperty("subreddit");
  if(currentSubreddit == null){
    currentSubreddit = "/r/popular";
  }
  
  // Create an input field for the new subreddit choice
  var textInput = CardService.newTextInput()
  .setFieldName("subredditChoice")
  .setTitle("Choose a subreddit:")
  .setHint("Currently " + currentSubreddit)
  // setOnChangeAction will allow users to press "Enter" and have the subreddit changed
  .setOnChangeAction(CardService.newAction().setFunctionName("subredditChange"));
  
  // Add a submit button
  var submitButton = CardService.newTextButton()
  .setText("Submit")
  .setOnClickAction(CardService.newAction().setFunctionName("subredditChange"))
  
  // Create card with the textInput and the submitButton
  var card = CardService.newCardBuilder()
  .addSection(CardService.newCardSection()
              .addWidget(textInput))
  .addSection(CardService.newCardSection()
              .addWidget(submitButton))
  .build();
  
  // Add card to the card array
  cards.push(card);
  
  // Return the card array to be displayed
  return cards;
}

/**
* This function loads a new subreddit into the UserProperties and gives feedback if the subreddit is
* not properly formatted.
*
* @return {Action}: Action that switches the navigation to give user feedback for a successful
*                   or unsuccessful subreddit change
*/
function subredditChange(e){
  var scriptProperties = PropertiesService.getUserProperties();
  
  // Get the user-submitted new subreddit
  var subredditChoice = e.formInput.subredditChoice;
  
  // Create text that will be displayed if the subreddit is valid
  var subredditValidText = "A reload is required to change your subreddit to "
  + subredditChoice
  + ". Please click on a different email, or reload the page.";
  
  // Create text that will be displayed if the subreddit is invalid
  var subredditInvalidText = "Subreddit '"
  + subredditChoice
  + "' is not a valid subreddit.";
  
  var subredditValid = true;
  var returnText = "";
  
  // Check if subreddit is valid, and give feedback to the user to help them correct their error
  if(subredditChoice.indexOf(" ") > -1){
    // Spaces are present in the subreddit name
    subredditValid = false;
    returnText += " Please remove spaces from your subreddit name.";
  }
  if(subredditChoice.indexOf("/r/") === -1){
    // '/r/' prefix is not present in subreddit name
    subredditValid = false;
    returnText += " Please add '/r/' to the beginning of your subreddit name.";
  }
  if(subredditChoice.length >= 25){
    // Subreddit name is too long, cannot exceed 21 characters (not including prefix)
    subredditValid = false; 
    returnText += " Please ensure that your subreddit is less than 22 characters, not counting the '/r/' prefix.";
  }
  
  // Build the card header depending on the validity of the subreddit
  var returnHeader = CardService.newCardHeader();
  if(subredditValid === true){
    returnHeader.setTitle("Please Reload.");
    returnText = subredditValidText;
  }else{
    returnHeader.setTitle("Invalid Subreddit");
    returnText = subredditInvalidText + returnText;
  }
  
  var replacementCard = CardService.newCardBuilder()
  .setHeader(returnHeader)
  .addSection(CardService.newCardSection()
              .addWidget(CardService.newTextParagraph()
                         .setText(returnText)))
  .build();
  
  // Change the navigation depending on the validity of the subreddit
  var nav;
  if(subredditValid === true){
    // If the subreddit is valid, set the 'subreddit' property and replace the root card with a message to reload the add on
    scriptProperties.setProperty("subreddit",subredditChoice);
    nav = CardService.newNavigation().popToRoot().updateCard(replacementCard);
    CacheService.getUserCache().remove("redditData");
    return CardService.newActionResponseBuilder()
    .setNavigation(nav)
    .setStateChanged(true)
    .build();
  }else{
    // If the subreddit is invalid, push a card with an error message, and allow the user
    // the opportunity to change their subreddit.
    nav = CardService.newNavigation().pushCard(replacementCard);
    return CardService.newActionResponseBuilder()
    .setNavigation(nav)
    .build();
  }
  
}
