/* config/middlewares/render.js */

/**
* Render HTML (express + nunjucks)
*   Works as a response.method that minifies html string
*   after nunjucks.render compiles and callback
* @param {String} view
* @param {Object} options
*/

export default function(req, res, next) {
    res.oldRender = res.render;
    res.render = function(view, options) {
		
        if(req.rendering){
			
            if(req.rendering.views){
                view = req.rendering.views+"/"+view;
            }
           
            if(req.rendering.layout){
				
                if(!options || options == 'undefined'){
                    options = {};
                }
                if(typeof options["layout"] === typeof undefined || options["layout"] === ""){
					options["layout"] = req.rendering.layout;
				}
            }
        }
		
        this.oldRender(view, options, function(err, html) {
            if (err) throw err;
            res.send(html);
        });
    };
    next();
};
