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
      // Convert Markdown formatting to HTML formatting
      body = parseMarkdown(post.selftext)
      
      selftextSection
      .setContent(body)
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
    
    // Set comments button
    var commentsAction = CardService.newAction()
    .setFunctionName("openCommentsAction")
    .setParameters({url: "https://reddit.com" + post.permalink + ".json?"});
    var commentsSection = CardService.newTextButton().setText("View Comments").setOnClickAction(commentsAction);
    
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
    .addSection(CardService.newCardSection().addWidget(commentsSection))
    .addSection(CardService.newCardSection().addWidget(selftextSection))
    .build();
    
    // Add card to list of cards that will be displayed to user
    sections.push(card)
  }
  
  // Return and display the cards to the user
  return sections;
}

/**
* This function allows the add on to push a comments card to the display.
* 
* @return {Action}: Action that pushes a comments card to the display
*/
function openCommentsAction(params, changeSort){
  // Check current sorting of comments
  var userProperties = PropertiesService.getUserProperties();
  if(userProperties.getProperty("sort") === null){
    userProperties.setProperty("sort", "confidence");
  }
  var sort = userProperties.getProperty("sort");
  
  // Grab comments from the post, don't bother caching because data is too big
  var comments = loadComments(params.parameters.url + "sort=" + sort);
  
  // Create a card containing comments  
  var card = CardService.newCardBuilder();
  
  // Create a dropdown for sorting comments
  var dropdown = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Sort comments by...")
    .setFieldName("comments_sorting")
    .addItem("Best", "confidence", sort === "confidence")
    .addItem("Top", "top", sort === "top")
    .addItem("New", "new", sort === "new")
    .addItem("Controversial", "controversial", sort === "controversial")
    .addItem("Old", "old", sort === "old")
    .addItem("Q&A", "qa", sort === "qa")
    .setOnChangeAction(CardService.newAction()
        .setFunctionName("changeCommentSort")
                       .setParameters({url: params.parameters.url}));
  
  // Add a note that the comments may take a bit to refresh
  var refreshNote = "<font color=#919191>You may need to wait a moment for the comments to refresh.</font>"
  
  card.addSection(CardService.newCardSection()
                  .addWidget(dropdown)
                 .addWidget(CardService.newTextParagraph().setText(refreshNote)))
  
  for(var i = 0; i < comments.length; i++){
    // Make sure we only parse comments
    if(comments[i].kind !== "t1"){
      continue;
    }
    
    var comment = comments[i].data;
    
    // Round score off to a multiple of 1000 if greater than 999
    var scoreNumber = comment.score;
    if(scoreNumber > 999){
      scoreNumber = Math.floor(scoreNumber / 1000) + "K points";
    }else{
      scoreNumber += " points";
    }
    if(comment.score_hidden == true){
      scoreNumber = "Score Hidden";
    }
    
    // Convert Markdown formatting to HTML formatting
    body = parseMarkdown("" + comment.body) // Required to "cast" the body to a string for whatever reason
    
    var widget = CardService.newKeyValue()
    .setMultiline(true)
    .setTopLabel("u/" + comment.author + " - " + scoreNumber)
    .setContent(body);
    
    card.addSection(CardService.newCardSection().addWidget(widget));
  }
  
  // If the changeSort function called, just return the card so we can push it
  if(changeSort){
    return card.build();
  }
  
  // Push the card to the display
  var nav = CardService.newNavigation().pushCard(card.build());
  return CardService.newActionResponseBuilder()
  .setNavigation(nav)
  .build();
}

/**
* This function changes the sort order of the comments.
* 
* @return {Action}: Action to pop the current comment card and push the new sorted card
*/
function changeCommentSort(params){
  var sort = params.formInput.comments_sorting;
  var userProperties = PropertiesService.getUserProperties().setProperty("sort", sort);
  
  // Simulate passing the params dict as if func is an actionResponse
  var commentsParams = {parameters: {url: params.parameters.url}};
  
  var commentsCard = openCommentsAction(commentsParams, true)
  
  var nav = CardService.newNavigation().popCard().pushCard(commentsCard);
  
  return CardService.newActionResponseBuilder()
  .setNavigation(nav)
  .build();
}

/**
* This function loads the comments of a specified Reddit post.
*
* @return {JSON Object}: object of comments for the post
*/
function loadComments(url){
  var response = UrlFetchApp.fetch(url);
  if(response.getResponseCode() !== 200){
    // Do something for non-200 response
  }
  var jsonData = JSON.parse(response.getContentText());
  var comments = jsonData[1].data.children;
  return comments;
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
* This function will parse Reddit markdown into Gmail add-on valid HTML.
*
* @return {string}: the parsed markdown
*/
function parseMarkdown(markdown){
  return markdown
  .replace(/\[(.*)\]\(([^\)]+\.[^\)]+)\)/g, "<a href=$2>$1</a>") // link
  .replace(/^&gt;(.*)$/gm, "<font color=#5980a6>$1</font>") // quote
  .replace(/~~([^*\n\r]+)~~/gm, "<s>$1</s>") // strikethrough
  .replace(/\*\*([^*\n\r]+)\*\*/gm, "<b>$1</b>") // need to replace bold before italics because same * character
  .replace(/\*([^*\n\r]+)\*/gm, "<i>$1</i>") // italics
  .replace(/^#+(.*)$/gm, "<b>$1</b>") // just make all headers bold
  .replace(/&amp;#x200B;/gm, " "); // get rid of all blank space characters
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
  if(response.getResponseCode() !== 200){
    // Error handling for non-200 status code
  }
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
  var userProperties = PropertiesService.getUserProperties();
  
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
    userProperties.setProperty("subreddit",subredditChoice);
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
