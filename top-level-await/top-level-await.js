import { TokenType, types as tt } from "babylon/lib/tokenizer/types";
import { plugins, prototype as pp } from "babylon/lib/parser";

plugins.topLevelAwait = function (instance) {
    instance.extend("parseTopLevel", function(file, program){
        return function(file, program){
            program.sourceType = this.options.sourceType;
            
            this.state.inAsync = true;
            var allowDirectives = false;
            this.parseBlockBody(program, allowDirectives, true, tt.eof);

            file.program  = this.finishNode(program, "Program");
            file.comments = this.state.comments;
            file.tokens   = this.state.tokens;

            return this.finishNode(file, "File");
        }
    })
}

console.log(plugins)

export default function({ types: t }) {
    return {
        manipulateOptions(opts, parserOpts) {
            parserOpts.plugins.push("topLevelAwait");
        }
        vistors{
            File(path){
                path.traverse({
                    AwaitExpression(){
                        checktoplevel
                    },
                    ExportSTatement(){

                    }
                })

                if(await && export){
                    throw error
                }
            }
        }
    };
}
